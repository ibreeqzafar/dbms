import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeReturnPath,oauthReturnError} from './auth-navigation.ts';
test('sign-in returns to local destinations without account loops or external redirects',()=>{assert.equal(safeReturnPath('/cart'),'/cart');assert.equal(safeReturnPath('/studio?item=bed'),'/studio?item=bed');for(const value of [null,'https://example.com','//example.com','/\\example.com','/account','/account?mode=register','/\n/evil'])assert.equal(safeReturnPath(value),'/')});
test('OAuth query and fragment failures are visible without leaking provider codes',()=>{assert.equal(oauthReturnError('',''), '');assert.match(oauthReturnError('?error=access_denied',''),/cancelled/);assert.match(oauthReturnError('','#error=server_error&error_description=private-code'),/could not complete/);assert(!oauthReturnError('?error=server_error&error_description=private-code','').includes('private-code'))});
