import { By, Key, until } from 'selenium-webdriver';
import moment from 'moment';

import { StatementDownloader } from './StatementDownloader';

export class HSBCStatementDownloader extends StatementDownloader {
  login(): PromiseLike<void> {
    return this.driver.get('https://www.hsbc.co.uk/1/2/welcome-gsp?initialAccess=true&IDV_URL=hsbc.MyHSBC_pib')
    .then(() => this.driver.sleep(3000))
    .then(() => this.driver.findElement(By.id('Username1')))

    .then((el) => el.sendKeys(this.username))

    .then(() => this.driver.findElement(By.css('.submit_input')))
    .then((el) => el.click());
  }

  selectLogOnWithoutSecureKey(): PromiseLike<void> {
    return this.driver.findElement(By.css('.listStyle02 li[aria-checked="false"]'))
      .then((el) => el.click());
  }

  answerMemorableQuestion(): PromiseLike<void> {
    return this.driver.findElement(By.id('memorableAnswer'))
      .then((el) => el.sendKeys(this.memorable_info));
  }

  fillMemorableInfoCharacter(idx: number): PromiseLike<void> {
    return new Promise((resolve, reject) => {
      this.driver.wait(until.elementLocated(By.css('.FontRed span:nth-child(' + idx + ')')), 10000)
        .then((el) =>
          this.driver.executeScript(() => {
            return arguments[0].innerHTML;
          }, el))

        .then((html: string) => {
          let secret_characters: string[] = this.password.split("");
          let wanted_char: number;

          //the spans either contain "1st, 2nd, 3rd, 4th, etc..." or "second to last"/"last" :)

          if (html.match(/(\d)\S\S/)) {
            wanted_char = +html.match(/(\d)\S\S/)[1];
          } else if (html.match(/second to last/)) {
            wanted_char = secret_characters.length - 1;
          } else if (html.match(/last/)) {
            wanted_char = secret_characters.length;
          }

          let answer = secret_characters[wanted_char - 1];

          this.driver.findElements(By.css('.smallestInput.active'))
            .then((els) => { els[idx - 1].sendKeys(answer) })
            .then(() => resolve())
        });
    });
  }

  downloadStatement(): PromiseLike<void> {
    // Clicking the button with selenium seems to do nothing.
    // No matter how I try to click it.
    // You'll be horrified to know that I found a way around it...

    const _constructDownloadStatementURL = (): Promise<string> => {
      return new Promise((resolve, reject) => {
        let now: moment.Moment = moment();
        let to_date: string = now.format('YYYY-MM-DD');
        // i'm not sure about that 'from date'
        // but I don't know if it matters?
        let from_date: string = now.subtract(2, 'month').format('YYYY-MM-DD');

        // sod it, let's just get all we need through the browser, life is short, right?
        // especially after reading `_downloadTransHistory` from HSBC's javascript file.
        // My life feels extremely short after that. Please call a doctor.
        this.driver.executeScript(() => {
          let args: string[] = arguments[0];
          let from_date: string = args[0];
          let to_date: string = args[1];

          // Construct the special URL
          // Format is:
          /* https://www.services.online-banking.hsbc.co.uk/gpib/channel/proxy/accountDataSvc/downloadTxnSumm/account/
              <some hashed form of the account number you can find in the DOM>?reqType=csv&from=<date, eg2018-03-08>&to=<date, eg2018-05-06>
              &formattedDisplyID=<sort code followed by a space followed by acc number, eg 00-00-00 12345678
              &currency=GBP&entProdCatCde=CHQ&availBal=<BALANCE, e.g. 90>&entProdTypCde=CAA&prodTypCde=DDA&ldgrBal=<BALANCE>&lastUpdtTime=<today's date>&txnHistType=U
          */

          let url: string = 'https://www.services.online-banking.hsbc.co.uk/gpib/channel/proxy/accountDataSvc/downloadTxnSumm/account/';

          let account_number_element: Element = document.querySelector('[data-account-number]');
          let account_number: string = account_number_element.getAttribute('data-account-number');

          let sort_code_and_account_elem: Element = document.querySelector('.itemDetailsContainer .itemName.tiny');
          let sort_code_and_account: string = sort_code_and_account_elem.innerHTML;

          let balance_element: Element = document.getElementById(account_number);
          let balance: string = balance_element.innerHTML;

          // format is "<what you need>||GBP||CAA||GB". The other strings are probably also useful, but..
          account_number = account_number.split('||')[0];

          //YMMV
          //                       ?reqType=csv&from=2018-03-08&to=2018-05-06  &formattedDisplyID=00-00-00 1234578       &currency=GBP&entProdCatCde=CHQ&availBal=89.45     &entProdTypCde=CAA&prodTypCde=DDA&ldgrBal=89.45     &lastUpdtTime=2018-05-06&txnHistType=U"
          url += `${account_number}?reqType=csv&from=${from_date}&to=${to_date}&formattedDisplyID=${sort_code_and_account}&currency=GBP&entProdCatCde=CHQ&availBal=${balance}&entProdTypCde=CAA&prodTypCde=DDA&ldgrBal=${balance}&lastUpdtTime=${to_date}&txnHistType=U`;

          console.log(url);
          return url;
        }, [from_date, to_date])
        .then((url: string) => resolve(url));
      })
    };

    return _constructDownloadStatementURL().then((url: string) => this.driver.get(url));
  }

  moveDownloadedCSV(): PromiseLike<string> {
    let file_pattern = `${this.downloads_dir}/TransHist.csv`;
    let month = this.month || moment().format('MMM');

    let new_filename = moment(new Date(month + '1 ' + moment().format('Y') + ' 00:00 UTC')).format('YMM') + 'h.csv';

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

    .then(() => this.selectLogOnWithoutSecureKey())


    .then(() => this.answerMemorableQuestion())

    .then(() => this.fillMemorableInfoCharacter(1))
    .then(() => this.fillMemorableInfoCharacter(2))
    .then(() => this.fillMemorableInfoCharacter(3))

    .then(() => this.driver.findElement(By.css('.submit_input')))
    .then((el) => el.click())
    .then(() => this.driver.sleep(5000))

    .then(() => this.downloadStatement())
    .then(() => this.driver.sleep(1000))
    .then(() => this.logOff())
    .then(() => this.moveDownloadedCSV())
    .then((csvname) => console.log("DOWNLOADED FILE " + csvname))
    .then(() => this.driver.quit())
    .then(() => console.log("DONE"));
  }
}
