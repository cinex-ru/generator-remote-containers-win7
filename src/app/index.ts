/* eslint-disable no-underscore-dangle */
import Generator from 'yeoman-generator';
import { promises as fs, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { parse, stringify } from 'comment-json';
import { performOsTask } from './utils';

interface VMState {
    name: string,
    isRunning: boolean
}

interface ContainerInfo {
    name: string;
    path: string
}

const remoteContainersRepoURL = 'https://github.com/microsoft/vscode-dev-containers.git';

const createNewVm = async (newVmName: string) => {
    await performOsTask('docker-machine', ['create', newVmName], `Creating new VM '${newVmName}'`);
};

const stopVm = async (vmName: string, skipError: boolean = false) => {
    await performOsTask('docker-machine', ['stop', vmName], `Stopping VM '${vmName}'`, undefined, skipError);
};

export default class RemoteContainersGenerator extends Generator {
    private readonly createNewVmValue = 'Create new VM';

    private dockerMachineVersion?: string;
    private vmsList: VMState[] = [];
    private containersTempDir?: string;
    private containersList: ContainerInfo[] = [];

    private answers: any;

    constructor(args: string | string[], opts: Generator.GeneratorOptions) {
        super(args, opts);
    }

    // eslint-disable-next-line class-methods-use-this
    async initializing() {
        this.log('Initializing workspace');
        await this._checkDockerMachineVersion();
        await this._getVMsList();
        await this._getContainersList();
    }

    async _checkDockerMachineVersion() {
        await performOsTask('docker-machine', ['version'], 'Checking docker-machine', undefined, false, async (result: string) => {
            this.dockerMachineVersion = result.match(/\d+\.\d+\.\d+/)?.pop();
            return this.dockerMachineVersion;
        });
    }

    async _getVMsList() {
        await performOsTask('docker-machine', ['ls', '-f', '{{ .Name }}\t{{ .State }}'], 'Getting VMs list',
            undefined, false, async (result: string) => {
                this.vmsList = result
                    .split('\n')
                    .filter((str) => str.length > 0)
                    .map((str) => str.split('\t'))
                    .map((arr) => ({
                        'name': arr[0],
                        'isRunning': arr[1] === 'Running',
                    }));
                return this.vmsList.length.toString();
            });
    }

    async _getContainersList() {
        const repoFolder = 'containers';
        this.containersTempDir = await fs.mkdtemp(path.join(tmpdir(), 'containers_'), {
            'encoding': 'utf8',
        });
        const containersFolder = path.join(this.containersTempDir, repoFolder);
        const spawnOptions = {
            'cwd': this.containersTempDir,
        };

        await performOsTask('git', ['init'], 'Git: init repo', spawnOptions);
        await performOsTask('git', ['sparse-checkout', 'init'], 'Git: sparse-checkout init', spawnOptions);
        await performOsTask('git', ['sparse-checkout', 'set', repoFolder], 'Git: sparse-checkout set', spawnOptions);
        await performOsTask('git', ['remote', 'add', 'origin', remoteContainersRepoURL], 'Git: add remote', spawnOptions);
        await performOsTask('git', ['pull', 'origin', 'master'], 'Git: pull containers', spawnOptions, true, async () => {
            const files = await fs.readdir(containersFolder, { 'encoding': 'utf8', 'withFileTypes': true });
            this.containersList = files
                .filter((file) => file.isDirectory())
                .map((file) => ({ 'name': file.name, 'path': path.join(containersFolder, file.name) }));
            return this.containersList.length.toString();
        });
    }

    async prompting() {
        this.answers = await this.prompt([
            {
                'type': 'list',
                'name': 'vmName',
                'message': 'Select VM to create wokspace or create new vm',
                'choices': [...this.vmsList.map((vm) => ({
                    'name': vm.name,
                    'value': vm.name,
                })),
                {
                    'type': 'separator',
                }, {
                    'name': this.createNewVmValue,
                    'value': this.createNewVmValue,
                }, {
                    'type': 'separator',
                },
                ],
            },
            {
                'type': 'input',
                'name': 'newVmName',
                'message': 'Enter new VM name',
                'when': (answers: any) => answers.vmName === this.createNewVmValue,
            },
            {
                'type': 'list',
                'name': 'containerPath',
                'message': 'Select container template',
                'choices': this.containersList.map((template) => ({ 'name': template.name, 'value': template.path })),
            },
            {
                'type': 'input',
                'name': 'appName',
                'message': 'Enter new application name',
                'validate': (input: string) => (/[a-z_][0-9a-z-_]*/i.test(input) ? true : 'Bad application name'),
            },
            {
                'type': 'input',
                'name': 'appFolder',
                'message': 'Enter new application folder',
                'default': (answers:any) => `./${answers.appName}`,
            },
        ]);
    }

    async configuring() {
        const { newVmName } = this.answers;
        if (newVmName) {
            await createNewVm(newVmName);
            this.answers.vmName = newVmName;
        }

        const { vmName } = this.answers;
        await stopVm(vmName, true);

        const { appFolder } = this.answers;
        if (existsSync(appFolder)) {
            throw new Error(`Path '${appFolder}' exists`);
        }

        fs.rename(this.answers.containerPath, appFolder);

        let existingFolderNames: string[] = [];
        await performOsTask('VBoxManage', ['showvminfo', vmName, '--machinereadable'], `Getting '${vmName}' shared folders list`,
            undefined, false, async (result: string) => {
                existingFolderNames = result
                    .split('\n')
                    .filter((str) => str.startsWith('SharedFolderNameMachineMapping'))
                    .map((str) => str.split('=').filter((s) => s.length > 0).pop()?.trim()
                        .slice(1, -1) || '')
                    .filter((str) => str.length > 0);
                return existingFolderNames.length.toString();
            });

        let { appName } = this.answers;
        let index = 1;
        while (existingFolderNames.indexOf(appName) >= 0) {
            appName = `${appName}-${index}`;
            index += 1;
        }

        path.resolve(appFolder);
        await performOsTask('VBoxManage',
            ['sharedfolder', 'add', vmName, `--name=${appName}`, `--hostpath=${path.resolve(appFolder)}`, '--automount'],
            `Adding shared folder to '${vmName}'`, undefined, false, async () => appName);

        const devContainerFolder = path.join(appFolder, '.devcontainer');
        const devContainerConfig = path.join(devContainerFolder, 'devcontainer.json');
        const devContainerScript = path.join(devContainerFolder, 'run-before-start-vscode.cmd');

        const textConfigData = await fs.readFile(devContainerConfig, { 'encoding': 'utf8' });
        const configData = parse(textConfigData);
        configData.workspaceMount = `type=bind,source=/${appName},target=/workspaces/${appName},consistency=cached`;
        configData.workspaceFolder = `/workspaces/${appName}`;
        await fs.writeFile(devContainerConfig, stringify(configData));
        await fs.writeFile(`${devContainerConfig}.bak`, textConfigData);

        const cmdScriptText = [
            `docker-machine start ${vmName}`,
            `FOR /f "tokens=* USEBACKQ" %%G IN (\`docker-machine env ${vmName}\`) DO %%G`,
        ].join('\n');
        await fs.writeFile(devContainerScript, cmdScriptText);
    }

    async end() {
        if (this.containersTempDir) {
            await fs.rmdir(this.containersTempDir, { 'recursive': true });
        }
    }
}
