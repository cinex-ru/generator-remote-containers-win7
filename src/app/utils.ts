import { TextDecoder } from 'util';
import logUpdate from 'log-update';
import logSymbols from 'log-symbols';
import chalk from 'chalk';
import childProcess from 'child_process';

export const textDecoder = new TextDecoder();

let logUpdateActive = false;

export const sleep = (ms: number) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});

export const startLogUpdate = async (operationTitle: string) => {
    logUpdateActive = true;
    const frames = ['-', '\\', '|', '/'];
    let i = 0;
    while (logUpdateActive) {
        const frame = frames[i = (i + 1) % frames.length];
        logUpdate(`${operationTitle} ${frame}`);
        // eslint-disable-next-line no-await-in-loop
        await sleep(50);
    }
};

export const stopLogUpdate = (operationTitle: string, isSuccessful: boolean, additionalData?: string) => {
    logUpdateActive = false;
    let addData = additionalData;
    if (!addData) {
        if (isSuccessful) {
            addData = 'ok';
        } else {
            addData = `[${chalk.red('fail')}]`;
        }
    }
    if (isSuccessful) {
        logUpdate(`${logSymbols.success} ${operationTitle} [${chalk.green.bold(addData)}]`);
    } else {
        logUpdate(`${logSymbols.error} ${operationTitle} ${chalk.red(addData)}`);
    }
    logUpdate.done();
};

export const performOsTask = async (command: string, args: string[], taskTitle: string, options?: childProcess.SpawnOptionsWithoutStdio,
    // eslint-disable-next-line no-unused-vars
    skipError: boolean = false, onEnd?: (result: string) => Promise<string | undefined>) => {
    const osTask = childProcess.spawn(command, args, options);
    const chunks: Buffer[] = [];

    osTask.stdout.on('data', (data) => {
        chunks.push(data);
    });

    osTask.stdout.on('end', async () => {
        let additionalData: string | undefined;
        const resultString = textDecoder.decode(new Uint8Array(chunks.flatMap((buffer) => [...buffer])));
        if (onEnd) {
            additionalData = await onEnd(resultString);
        }
        stopLogUpdate(taskTitle, true, additionalData);
    });

    osTask.stderr.on('data', (data) => {
        // git pull print to stderr
        // TODO: filter stderr output
        if (!skipError) {
            const errorMessage = textDecoder.decode(data);
            stopLogUpdate(taskTitle, false, errorMessage);
            throw Error(errorMessage);
        }
    });

    await startLogUpdate(taskTitle);
};
