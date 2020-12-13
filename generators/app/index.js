"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-underscore-dangle */
const yeoman_generator_1 = __importDefault(require("yeoman-generator"));
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = __importDefault(require("path"));
const comment_json_1 = require("comment-json");
const utils_1 = require("./utils");
const remoteContainersRepoURL = 'https://github.com/microsoft/vscode-dev-containers.git';
const createNewVm = async (newVmName) => {
    await utils_1.performOsTask('docker-machine', ['create', newVmName], `Creating new VM '${newVmName}'`);
};
const stopVm = async (vmName, skipError = false) => {
    await utils_1.performOsTask('docker-machine', ['stop', vmName], `Stopping VM '${vmName}'`, undefined, skipError);
};
class RemoteContainersGenerator extends yeoman_generator_1.default {
    constructor(args, opts) {
        super(args, opts);
        this.createNewVmValue = 'Create new VM';
        this.vmsList = [];
        this.containersList = [];
    }
    // eslint-disable-next-line class-methods-use-this
    async initializing() {
        this.log('Initializing workspace');
        await this._checkDockerMachineVersion();
        await this._getVMsList();
        await this._getContainersList();
    }
    async _checkDockerMachineVersion() {
        await utils_1.performOsTask('docker-machine', ['version'], 'Checking docker-machine', undefined, false, async (result) => {
            var _a;
            this.dockerMachineVersion = (_a = result.match(/\d+\.\d+\.\d+/)) === null || _a === void 0 ? void 0 : _a.pop();
            return this.dockerMachineVersion;
        });
    }
    async _getVMsList() {
        await utils_1.performOsTask('docker-machine', ['ls', '-f', '{{ .Name }}\t{{ .State }}'], 'Getting VMs list', undefined, false, async (result) => {
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
        this.containersTempDir = await fs_1.promises.mkdtemp(path_1.default.join(os_1.tmpdir(), 'containers_'), {
            'encoding': 'utf8',
        });
        const containersFolder = path_1.default.join(this.containersTempDir, repoFolder);
        const spawnOptions = {
            'cwd': this.containersTempDir,
        };
        await utils_1.performOsTask('git', ['init'], 'Git: init repo', spawnOptions);
        await utils_1.performOsTask('git', ['sparse-checkout', 'init'], 'Git: sparse-checkout init', spawnOptions);
        await utils_1.performOsTask('git', ['sparse-checkout', 'set', repoFolder], 'Git: sparse-checkout set', spawnOptions);
        await utils_1.performOsTask('git', ['remote', 'add', 'origin', remoteContainersRepoURL], 'Git: add remote', spawnOptions);
        await utils_1.performOsTask('git', ['pull', 'origin', 'master'], 'Git: pull containers', spawnOptions, true, async () => {
            const files = await fs_1.promises.readdir(containersFolder, { 'encoding': 'utf8', 'withFileTypes': true });
            this.containersList = files
                .filter((file) => file.isDirectory())
                .map((file) => ({ 'name': file.name, 'path': path_1.default.join(containersFolder, file.name) }));
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
                'when': (answers) => answers.vmName === this.createNewVmValue,
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
                'validate': (input) => (/[a-z_][0-9a-z-_]*/i.test(input) ? true : 'Bad application name'),
            },
            {
                'type': 'input',
                'name': 'appFolder',
                'message': 'Enter new application folder',
                'default': (answers) => `./${answers.appName}`,
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
        if (fs_1.existsSync(appFolder)) {
            throw new Error(`Path '${appFolder}' exists`);
        }
        fs_1.promises.rename(this.answers.containerPath, appFolder);
        let existingFolderNames = [];
        await utils_1.performOsTask('VBoxManage', ['showvminfo', vmName, '--machinereadable'], `Getting '${vmName}' shared folders list`, undefined, false, async (result) => {
            existingFolderNames = result
                .split('\n')
                .filter((str) => str.startsWith('SharedFolderNameMachineMapping'))
                .map((str) => {
                var _a;
                return ((_a = str.split('=').filter((s) => s.length > 0).pop()) === null || _a === void 0 ? void 0 : _a.trim().slice(1, -1)) || '';
            })
                .filter((str) => str.length > 0);
            return existingFolderNames.length.toString();
        });
        let { appName } = this.answers;
        let index = 1;
        while (existingFolderNames.indexOf(appName) >= 0) {
            appName = `${appName}-${index}`;
            index += 1;
        }
        path_1.default.resolve(appFolder);
        await utils_1.performOsTask('VBoxManage', ['sharedfolder', 'add', vmName, `--name=${appName}`, `--hostpath=${path_1.default.resolve(appFolder)}`, '--automount'], `Adding shared folder to '${vmName}'`, undefined, false, async () => appName);
        const devContainerFolder = path_1.default.join(appFolder, '.devcontainer');
        const devContainerConfig = path_1.default.join(devContainerFolder, 'devcontainer.json');
        const devContainerScript = path_1.default.join(devContainerFolder, 'run-before-start-vscode.cmd');
        const textConfigData = await fs_1.promises.readFile(devContainerConfig, { 'encoding': 'utf8' });
        const configData = comment_json_1.parse(textConfigData);
        configData.workspaceMount = `type=bind,source=/${appName},target=/workspaces/${appName},consistency=cached`;
        configData.workspaceFolder = `/workspaces/${appName}`;
        await fs_1.promises.writeFile(devContainerConfig, comment_json_1.stringify(configData));
        await fs_1.promises.writeFile(`${devContainerConfig}.bak`, textConfigData);
        const cmdScriptText = [
            `docker-machine start ${vmName}`,
            `FOR /f "tokens=* USEBACKQ" %%G IN (\`docker-machine env ${vmName}\`) DO %%G`,
        ].join('\n');
        await fs_1.promises.writeFile(devContainerScript, cmdScriptText);
    }
    async end() {
        if (this.containersTempDir) {
            await fs_1.promises.rmdir(this.containersTempDir, { 'recursive': true });
        }
    }
}
exports.default = RemoteContainersGenerator;
