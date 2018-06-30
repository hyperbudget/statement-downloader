import {Builder, By, ThenableWebDriver} from 'selenium-webdriver';

import * as path from 'path';
import { mkdirp } from 'mkdirp';

import { move_file } from './Util';
import { MutedQuestion } from './MutedQuestion';

export abstract class StatementDownloader {
  driver: ThenableWebDriver;

  password: string;
  memorable_info: string;
  save_dir: string;
  downloads_dir: string;
  username: string;
  account?: string;
  month?: string;

  constructor(args:
    {
      save_dir: string,
      username: string,
      downloads_dir: string,
      account?: string,
      month?: string,
      password?: string,
      memorable_info?: string,
    }) {
    this.save_dir = args.save_dir;
    this.username = args.username;
    this.downloads_dir = args.downloads_dir;
    this.account = args.account;
    this.month = args.month;
    this.password = args.password;
    this.memorable_info = args.memorable_info;
  }

  build_driver(): void {
    this.driver = new Builder().
    withCapabilities({
      'browserName': 'chrome', // the only reason for this is chrome saves files to ~/Downloads by default and we need to rely on that to grab the statement.
    }).
    build();
  }

  abstract login(): PromiseLike<void>;
  abstract fillMemorableInfoCharacter(idx: number): PromiseLike<void>;
  abstract downloadStatement(): PromiseLike<void>;

  logOff(): PromiseLike<void> {
    return this.driver.findElement(By.css('a[title="Log off"]'))
      .then((el) => el.click());
  }

  makeSaveDir(): PromiseLike<void> {
    return new Promise((resolve, reject) => mkdirp(this.save_dir, (err) => err ? reject(err) : resolve()));
  }

  moveDownloadedCSV(file_pattern?: string, new_filename?: string): PromiseLike<string> {
    new_filename = path.join(this.save_dir, new_filename);
    return move_file(file_pattern, new_filename);
  }

  getPasswordAndMemorableInfo(): PromiseLike<{password: string, memorable_info: string}> {
    return new Promise((resolve, reject) => {
      if (this.password && this.memorable_info) {
        return resolve({ password: this.password, memorable_info: this.memorable_info });
      }

      const question = new MutedQuestion();

      question.ask("What is your password?\n", (pass) => {
        question.ask("\nWhat is your memorable info?\n", (mem) => {
          question.close();
          resolve({password: pass, memorable_info: mem});
        });
      });
    });
  }

  abstract doDownloadStatement(): PromiseLike<void>;
}
