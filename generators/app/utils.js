"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.performOsTask = exports.stopLogUpdate = exports.startLogUpdate = exports.sleep = exports.textDecoder = void 0;
const util_1 = require("util");
const log_update_1 = __importDefault(require("log-update"));
const log_symbols_1 = __importDefault(require("log-symbols"));
const chalk_1 = __importDefault(require("chalk"));
const child_process_1 = __importDefault(require("child_process"));
exports.textDecoder = new util_1.TextDecoder();
let logUpdateActive = false;
const sleep = (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});
exports.sleep = sleep;
const startLogUpdate = async (operationTitle) => {
    logUpdateActive = true;
    const frames = ['-', '\\', '|', '/'];
    let i = 0;
    while (logUpdateActive) {
        const frame = frames[i = (i + 1) % frames.length];
        log_update_1.default(`${operationTitle} ${frame}`);
        // eslint-disable-next-line no-await-in-loop
        await exports.sleep(50);
    }
};
exports.startLogUpdate = startLogUpdate;
const stopLogUpdate = (operationTitle, isSuccessful, additionalData) => {
    logUpdateActive = false;
    let addData = additionalData;
    if (!addData) {
        if (isSuccessful) {
            addData = 'ok';
        }
        else {
            addData = `[${chalk_1.default.red('fail')}]`;
        }
    }
    if (isSuccessful) {
        log_update_1.default(`${log_symbols_1.default.success} ${operationTitle} [${chalk_1.default.green.bold(addData)}]`);
    }
    else {
        log_update_1.default(`${log_symbols_1.default.error} ${operationTitle} ${chalk_1.default.red(addData)}`);
    }
    log_update_1.default.done();
};
exports.stopLogUpdate = stopLogUpdate;
const performOsTask = async (command, args, taskTitle, options, 
// eslint-disable-next-line no-unused-vars
skipError = false, onEnd) => {
    const osTask = child_process_1.default.spawn(command, args, options);
    const chunks = [];
    osTask.stdout.on('data', (data) => {
        chunks.push(data);
    });
    osTask.stdout.on('end', async () => {
        let additionalData;
        const resultString = exports.textDecoder.decode(new Uint8Array(chunks.flatMap((buffer) => [...buffer])));
        if (onEnd) {
            additionalData = await onEnd(resultString);
        }
        exports.stopLogUpdate(taskTitle, true, additionalData);
    });
    osTask.stderr.on('data', (data) => {
        // git pull print to stderr
        // TODO: filter stderr output
        if (!skipError) {
            const errorMessage = exports.textDecoder.decode(data);
            exports.stopLogUpdate(taskTitle, false, errorMessage);
            throw Error(errorMessage);
        }
    });
    await exports.startLogUpdate(taskTitle);
};
exports.performOsTask = performOsTask;
