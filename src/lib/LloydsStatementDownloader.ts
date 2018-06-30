import { By, Key, until } from 'selenium-webdriver';
import moment from 'moment';

import { StatementDownloader } from './StatementDownloader';

export class LloydsStatementDownloader extends StatementDownloader {
  login(): PromiseLike<void> {
    return this.driver.get('https://online.lloydsbank.co.uk/personal/logon/login.jsp')
      .then(() => this.driver.findElement(By.id('frmLogin:strCustomerLogin_userID')))
      .then((el) => el.sendKeys(this.username))

      .then(() => this.driver.findElement(By.id('frmLogin:strCustomerLogin_pwd')))
      .then((el) => el.sendKeys(this.password))

      .then(() => this.driver.findElement(By.id('frmLogin:btnLogin2')))
      .then((el) => el.click());
  }

  fillMemorableInfoCharacter(idx: number): PromiseLike<void> {
    return new Promise((resolve, reject) => {
      this.driver.wait(until.elementLocated(By.css('label[for="frmentermemorableinformation1:strEnterMemorableInformation_memInfo' + idx + '"]')), 10000)
        .then((el) =>
          this.driver.executeScript(() => {
            return arguments[0].innerHTML;
          }, el))

        .then((html: string) => {
          let wanted_char: number = +html.match(/Character (\d) :/)[1];
          let secret_characters: string[] = this.memorable_info.split("");
          let answer: string = secret_characters[wanted_char - 1];

          this.driver.findElement(By.id('frmentermemorableinformation1:strEnterMemorableInformation_memInfo' + idx))
            .then((el) => el.sendKeys(answer))
            .then(() => resolve());
        })
    });
  }

  viewStatement(): PromiseLike<void> {
    // sometimes you get an advert/info and asked to click a button to continue, but not always.
    return this.driver.findElements(By.id('frmMdlSAN:continueBtnSAN'))
      .then(
        (elems) => {
          return new Promise((resolve, reject) => {
            if (!!elems.length) {
              return this.driver.findElement(By.id('frmMdlSAN:continueBtnSAN'))
                .then((el) => el.click())
                .then(() => resolve());
            } else {
              return resolve();
            }
          });
        }
      )
      .then(() => this.driver.findElement(By.css('a[title="View statement"]'))) // only works with the 1st account
      .then((el) => el.click());
  }

  selectCurrentMonth(): PromiseLike<void> {
    let month = this.month || moment().format('MMM');
    return this.driver.findElement(By.css(`button[aria-label="${month} transactions"]`))
      .then((el) => el.click());
  }

  openStatementOptions(): PromiseLike<void> {
    return this.driver.findElement(By.css('button[aria-label="Statement options"]'))
      .then((el) => el.sendKeys(Key.DOWN, Key.DOWN, Key.DOWN, Key.DOWN, Key.ENTER))
  }

  downloadStatement(): PromiseLike<void> {
    return new Promise((resolve, reject) => {
      this.driver.findElement(By.css('select[name="exportFormat"]'))
      .then((el) => el.sendKeys('I')) // Internet banking (CSV)
      .then(() => this.driver.findElement(By.id('exportStatementsButton')))
      .then((el) => el.click())
      .then(resolve);
    });
  }

  closeModal() {
    return this.driver.findElement(By.id('modal-close')).then((el) => el.click());
  }

  moveDownloadedCSV() {
    let file_pattern = this.account + "_" + moment().format('YMMDD');
    file_pattern = `${this.downloads_dir}/${file_pattern}*.csv`;

    let month = this.month || moment().format('MMM');

    let new_filename = moment(new Date(month + '1 ' + moment().format('Y') + ' 00:00 UTC')).format('YMM') + '.csv';
    return super.moveDownloadedCSV(file_pattern, new_filename);
  }

  doDownloadStatement(): PromiseLike<void> {
    return this.getPasswordAndMemorableInfo()
    .then((details) => {
      this.password = details.password;
      this.memorable_info = details.memorable_info;
    })
    .then(() => this.build_driver())
    .then(() => this.makeSaveDir())

    .then(() => this.login())
    .then(() => this.driver.wait(until.titleIs('Lloyds Bank - Enter Memorable Information'), 10000))
    .then(() => this.fillMemorableInfoCharacter(1))
    .then(() => this.fillMemorableInfoCharacter(2))
    .then(() => this.fillMemorableInfoCharacter(3))
    .then(() => this.driver.findElement(By.id('frmentermemorableinformation1:btnContinue')))

    .then((el) => el.click())
    .then(() => this.viewStatement())

    // there's ajax magic so give it a few seconds
    .then(() => this.driver.sleep(1000))
    .then(() => this.selectCurrentMonth())
    .then(() => this.driver.sleep(1000))
    .then(() => this.openStatementOptions())
    .then(() => this.driver.sleep(1000))
    .then(() => this.downloadStatement())
    .then(() => this.driver.sleep(2000))

    .then(() => this.closeModal())
    .then(() => this.logOff())

    .then(() => this.moveDownloadedCSV())
    .then((csvname) => console.log("DOWNLOADED FILE " + csvname))
    .then(() => this.driver.quit())
    .then(() => console.log("DONE"));
  }
}
