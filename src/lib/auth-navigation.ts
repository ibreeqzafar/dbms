/** Only allow a local route after sign-in, never an external redirect. */
export function safeReturnPath(value:string|null){return value&&value.startsWith('/')&&!value.startsWith('//')&&!/[\\\u0000-\u0020]/.test(value)&&!value.startsWith('/account')?value:'/'}
