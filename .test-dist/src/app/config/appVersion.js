"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_VERSION_LABEL = exports.APP_VERSION = void 0;
const app_version_json_1 = __importDefault(require("./app-version.json"));
exports.APP_VERSION = app_version_json_1.default.version;
exports.APP_VERSION_LABEL = `v${exports.APP_VERSION}`;
