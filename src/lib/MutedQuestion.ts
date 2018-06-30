import * as readline from 'readline';
import { MutableWritable } from './MutableWritable';

export class MutedQuestion {
  private rl: readline.ReadLine;
  private writable: MutableWritable;

  constructor() {
    this.writable = new MutableWritable();
    this.open();
  }

  open() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: this.writable,
      terminal: true,
    });
  }

  ask(question: string, cb: (answer: string) => void) {
    this.writable.unmute();
    this.rl.question(question, cb);
    this.writable.mute();
  }

  close() {
    this.rl.close();
  }
};
