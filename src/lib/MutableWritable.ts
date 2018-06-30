import { Writable } from 'stream';

export class MutableWritable extends Writable {
  muted: boolean = false;

  write(chunk: any, callback?: Function);
  write(chunk: any, encoding?: string, callback?: Function);
  write(chunk: any, encodingOrCallback?: string|Function, callback?: Function): boolean {
    let encoding = 'utf8';

    if (typeof encodingOrCallback === 'function') {
      callback = encodingOrCallback;
    } else if (typeof encodingOrCallback === 'string') {
      encoding = encodingOrCallback;
    }

    if (!this.muted) {
      process.stdout.write(chunk, encoding);
    }
    if (callback) {
      callback();
    }

    return true;
  }

  mute() { this.muted = true; }
  unmute() { this.muted = false; }
  toggleMute() { this.muted = !this.muted }
};
