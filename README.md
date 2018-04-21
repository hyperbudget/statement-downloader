# statement-downloader
Automagic node-webdriver-selenium-based bank statement downloader. *USE AT OWN RISK*

## What is this monstrosity?
It logs in to your bank account and downloads your bank statement. *Yeaaaah...*

Currently only works for Lloyds bank.

## How?
```
npm install
node lloyds-statement-downloader.js -u USERNAME -p MYPASSWORD -s MY_MEMORABLE_INFO -a ACCOUNT_NUMBER --dir=/home/myuser/bank
```

## WHY!?
Saves a few seconds for using [hyperbudget](https://github.com/hyperbudget/hyperbudget)

### Have you ever considered that just because you can doesn't mean you should?
No!

## CAVEATS
* Your bank password will be saved in your terminal history in plan text
    * I want some way of storing it in an encrypted configuration file though... or maybe even integrate with something like 1Password?
* It starts a chrome session
    * It should be relatively easy to hide it inside an Xvfb though.

## MRW I wrote this thing

![What have I done!?](https://www.errietta.me/whathaveidone.png)

## DISCLAIMER

We have no responsibility if using this script results in you losing all of your money, having your bank account closed, dying, or any other consequences. Checks your bank's policies before using it.
