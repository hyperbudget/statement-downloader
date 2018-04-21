const {Builder, By, Key, until} = require('selenium-webdriver');

let driver = new Builder().
  withCapabilities({
    'browserName': 'firefox',
  }).
  build();

driver.get('https://online.lloydsbank.co.uk/personal/logon/login.jsp')
.then(() => driver.findElement(By.id('frmLogin:strCustomerLogin_userID')))
.then((el) => el.sendKeys(process.env.L_USERNAME))

.then(() => driver.findElement(By.id('frmLogin:strCustomerLogin_pwd')))
.then((el) => el.sendKeys(process.env.L_PASSWORD))

.then(() => driver.findElement(By.id('frmLogin:btnLogin2')))
.then((el) => el.click())


.then(() => driver.wait(until.titleIs('Lloyds Bank - Enter Memorable Information'), 10000))


.then(() => {

  return new Promise(function(resolve, reject) {
    for (let i = 1; i <= 3; i++) {

      (function(chr) {
        driver.wait(until.elementLocated(By.css('label[for="frmentermemorableinformation1:strEnterMemorableInformation_memInfo' + chr + '"]')), 10000)
        .then((el) =>
          driver.executeScript(function() {
            return arguments[0].innerHTML;
          }, el))

        .then((html) => {
          console.log(html);
          console.log(html.match(/Character (\d) :/));
          Promise.resolve();
        })
      })(i);
    }

    resolve();
  });
})
.then(() => console.log("Moo"));

/*
myElement.getInnerHtml().then(function(html) {
    //do stuff with html here
});*/

;
