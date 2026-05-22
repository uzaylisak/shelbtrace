import { Account } from "@aptos-labs/ts-sdk";

const account = Account.generate();
console.log("Private key :", account.privateKey.toString());
console.log("Address     :", account.accountAddress.toString());
