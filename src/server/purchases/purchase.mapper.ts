export function serialize<T>(v:T):T { return JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)); }
