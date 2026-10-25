import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeReturnPath} from './auth-navigation.ts';
test('sign-in returns to local destinations without account loops or external redirects',()=>{assert.equal(safeReturnPath('/cart'),'/cart');assert.equal(safeReturnPath('/studio?item=bed'),'/studio?item=bed');for(const value of [null,'https://example.com','//example.com','/\\example.com','/account','/account?mode=register','/\n/evil'])assert.equal(safeReturnPath(value),'/')});
