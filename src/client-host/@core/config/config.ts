import * as OS from 'os';
import * as Path from 'path';

import {AbstractConfig} from '../../../../bld/node-shared';

import {RawConfig} from './raw-config';

export class Config extends AbstractConfig<RawConfig> {
  constructor(path: string) {
    super(path);
  }

  get remoteURL(): string {
    let {
      remote: {host, url},
    } = this.raw;

    return url || `http://${host}:8022`;
  }

  get remoteHost(): string {
    return this.raw.remote.host;
  }

  get port(): number {
    let {port = 8022} = this.raw;
    return port;
  }

  get vscodeExecutable(): string {
    let {vscodeExecutable = 'code'} = this.raw;
    return vscodeExecutable;
  }

  get sshConfigFilePath(): string {
    let {sshConfig} = this.raw;

    return sshConfig
      ? Path.resolve(sshConfig)
      : Path.join(OS.homedir(), '.ssh/config');
  }
}