import {Builder, By, ThenableWebDriver} from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';

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
  driver_opts?: { headless?: boolean };

  constructor(args:
    {
      save_dir: string,
      username: string,
      downloads_dir: string,
      account?: string,
      month?: string,
      password?: string,
      memorable_info?: string,
      driver_opts?: { headless?: boolean },
    }) {
    this.save_dir = args.save_dir;
    this.username = args.username;
    this.downloads_dir = args.downloads_dir;
    this.account = args.account;
    this.month = args.month;
    this.password = args.password;
    this.memorable_info = args.memorable_info;
    this.driver_opts = args.driver_opts;
  }

  build_driver(): void {
    const builder: Builder = new Builder().
    withCapabilities({
      'browserName': 'chrome', // the only reason for this is chrome saves files to ~/Downloads by default and we need to rely on that to grab the statement.
    });

    if (this.driver_opts.headless) {
      builder.setChromeOptions((<any>new chrome.Options()).windowSize({ width: 1626, height: 768 }).headless());
    }

    this.driver = builder.build();
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
