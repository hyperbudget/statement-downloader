const {Builder, By, Key, until} = require('selenium-webdriver');
const moment = require('moment');
const path = require('path');
const mkdirp = require('mkdirp');
const readline = require('readline');
const Writable = require('stream').Writable;

const { move_file } = require('./lib/util');

const downloads_dir = path.join(process.env.HOME, '/Downloads');

/* I don't really like the way this works but I got it from
 * https://stackoverflow.com/a/33500118 . It hides passwords in terminals. */

const mutableStdout = new Writable({
  write: function(chunk, encoding, callback) {
    if (!this.muted)
      process.stdout.write(chunk, encoding);
    callback();
  }
});

mutableStdout.muted = false;

const rl = readline.createInterface({
  input: process.stdin,
  output: mutableStdout,
  terminal: true,
});

let opt = require('node-getopt').create([
    ['u', 'hsbc_username=ARG', 'The username'],
    ['a', 'hsbc_account=ARG', 'The bank account number'],
    ['', 'month[=ARG]', 'The month of the statement (Jan, Feb, Mar..); defaults to current month'],
    ['', 'dir[=ARG]', 'Directory to shove the statement in. Absolute paths only'],
]).bindHelp().parseSystem();

const save_dir = opt.options.dir || path.join(process.env.HOME, '/bank2');

let password, secret;

function build_driver() {
  return new Builder().
  withCapabilities({
    'browserName': 'chrome', // the only reason for this is chrome saves files to ~/Downloads by default and we need to rely on that to grab the statement.
  }).
  build();
}

function login(driver) {
  return driver.get('https://www.hsbc.co.uk/1/2/welcome-gsp?initialAccess=true&IDV_URL=hsbc.MyHSBC_pib')
  .then(() => driver.sleep(3000))
  .then(() => driver.findElement(By.id('Username1')))

  .then((el) => el.sendKeys(opt.options.hsbc_username))

  .then(() => driver.findElement(By.css('.submit_input')))
  .then((el) => el.click());
}

function selectLogOnWithoutSecureKey(driver) {
  return driver.findElement(By.css('.listStyle02 li[aria-checked="false"]'))
    .then((el) => el.click());
}

function answerMemorableQuestion(driver) {
  return driver.findElement(By.id('memorableAnswer'))
    .then((el) => el.sendKeys(secret));
}

function fillMemorableInfoCharacter(driver, idx) {
  return new Promise(function (resolve, reject) {
    driver.wait(until.elementLocated(By.css('.FontRed span:nth-child(' + idx + ')')), 10000)
    .then((el) =>
        driver.executeScript(function() {
          return arguments[0].innerHTML;
        }, el))

    .then((html) => {
      let secret_characters = password.split("");
      let wanted_char;

      //the spans either contain "1st, 2nd, 3rd, 4th, etc..." or "second to last"/"last" :)

      if (html.match(/(\d)\S\S/)) {
        wanted_char = html.match(/(\d)\S\S/)[1];
      } else if (html.match(/second to last/)) {
        wanted_char = secret_characters.length - 1;
      } else if (html.match(/last/)) {
        wanted_char = secret_characters.length;
      }

      let answer = secret_characters[wanted_char - 1];

      driver.findElements(By.css('.smallestInput.active'))
        .then((els) => { els[idx - 1].sendKeys(answer) } )
        .then(() => resolve())
    });
  });
}

// Currently unused
function openStatementOptions(driver) {
  return driver.findElement(By.id('dapViewMoreDownload'))
  .then((el) => el.click());
}

function downloadStatement(driver) {
  // Clicking the button with selenium seems to do nothing.
  // No matter how I try to click it.
  // You'll be horrified to know that I found a way around it...

  function _constructDownloadStatementURL() {
    return new Promise((resolve, reject) => {
      let now = moment();
      let to_date = now.format('YYYY-MM-DD');
      // i'm not sure about that 'from date'
      // but I don't know if it matters?
      let from_date = now.subtract(2, 'month').format('YYYY-MM-DD');

      // sod it, let's just get all we need through the browser, life is short, right?
      // especially after reading `_downloadTransHistory` from HSBC's javascript file.
      // My life feels extremely short after that. Please call a doctor.
      driver.executeScript(() => {
        let args = arguments[0];
        let from_date = args[0];
        let to_date  = args[1];

        // Construct the special URL
        // Format is:
        /* https://www.services.online-banking.hsbc.co.uk/gpib/channel/proxy/accountDataSvc/downloadTxnSumm/account/
            <some hashed form of the account number you can find in the DOM>?reqType=csv&from=<date, eg2018-03-08>&to=<date, eg2018-05-06>
            &formattedDisplyID=<sort code followed by a space followed by acc number, eg 00-00-00 12345678
            &currency=GBP&entProdCatCde=CHQ&availBal=<BALANCE, e.g. 90>&entProdTypCde=CAA&prodTypCde=DDA&ldgrBal=<BALANCE>&lastUpdtTime=<today's date>&txnHistType=U
        */

        let url = 'https://www.services.online-banking.hsbc.co.uk/gpib/channel/proxy/accountDataSvc/downloadTxnSumm/account/';

        let account_number_element = document.querySelector('[data-account-number]');
        let account_number = account_number_element.getAttribute('data-account-number');

        let sort_code_and_account_elem = document.querySelector('.itemDetailsContainer .itemName.tiny');
        let sort_code_and_account = sort_code_and_account_elem.innerHTML;

        let balance_element = document.getElementById(account_number);
        let balance = balance_element.innerHTML;

        // format is "<what you need>||GBP||CAA||GB". The other strings are probably also useful, but..
        account_number = account_number.split('||')[0];

        //YMMV
        //                       ?reqType=csv&from=2018-03-08&to=2018-05-06  &formattedDisplyID=00-00-00 1234578       &currency=GBP&entProdCatCde=CHQ&availBal=89.45     &entProdTypCde=CAA&prodTypCde=DDA&ldgrBal=89.45     &lastUpdtTime=2018-05-06&txnHistType=U"
        url += `${account_number}?reqType=csv&from=${from_date}&to=${to_date}&formattedDisplyID=${sort_code_and_account}&currency=GBP&entProdCatCde=CHQ&availBal=${balance}&entProdTypCde=CAA&prodTypCde=DDA&ldgrBal=${balance}&lastUpdtTime=${to_date}&txnHistType=U`;

        console.log(url);
        return url;
      }, [from_date, to_date])
      .then((url) => resolve(url));
    })
  }

  return _constructDownloadStatementURL().then((url) => driver.get(url));
}


function logOff(driver) {
  return driver.findElement(By.css('a[title="Log off"]'))
    .then((el) => el.click());
}

function makeSaveDir() {
  return new Promise((resolve, reject) => mkdirp(save_dir, (err) => err ? reject(err) : resolve()));
}

function moveDownloadedCSV() {
  let file_pattern = `${downloads_dir}/TransHist.csv`;
  let month = opt.options.month || moment().format('MMM');

  let new_filename = moment(new Date(month + '1 ' + moment().format('Y') + ' 00:00 UTC')).format('YMM') + 'h.csv';
  new_Filename = path.join(save_dir, new_filename);

  return move_file(file_pattern, new_filename);
}


rl.question("What is your password?\n", (pass) => {
  password = pass;
  // Un-mute to ask the next question.
  mutableStdout.muted = false;

  rl.question("\nWhat is your memorable info?\n", (mem) => {
    secret = mem;
    rl.close();

    let driver = build_driver();

    makeSaveDir()

    .then(() => login(driver))

    .then(() => selectLogOnWithoutSecureKey(driver))


    .then(() => answerMemorableQuestion(driver))

    .then(() => fillMemorableInfoCharacter(driver, 1))
    .then(() => fillMemorableInfoCharacter(driver, 2))
    .then(() => fillMemorableInfoCharacter(driver, 3))

    .then(() => driver.findElement(By.css('.submit_input')))

    .then((el) => el.click())

    .then(() => driver.sleep(5000))

    .then(() => downloadStatement(driver))
    .then(() => driver.sleep(1000))
    .then(() => logOff(driver))
    .then(() => moveDownloadedCSV())
    .then((csvname) => console.log("DOWNLOADED FILE " + csvname))
    .then(() => driver.quit())
    .then(() => console.log("DONE"));
  });

  /* Essentially we're muting after we've asked the question but before we've got
   * the answer. That way the answer is invisible. */
  mutableStdout.muted = true;
});

mutableStdout.muted = true;

// Again muting right after we've asked the question.
// Thanks to all the async stuff going on, this is the order the above code is executed:
// 1: line 196, the question is asked.
// 2: line 239, mutableStdout.muted is turned on
// 3: User inputs the password, which is invisible.
// 4: lines 197-199 are executed, which stores the password in 'password' and un-mutes the output so we can ask the next question.
// 5. line 201, again question is asked
// 6. line 236, muting the output again.
// 7. lines 202-231 after the user has answered.
