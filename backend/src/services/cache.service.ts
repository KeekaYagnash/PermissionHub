export interface CacheEntry<T>{value:T;expiresAt:number;createdAt:number}
export interface CacheStore{
 get<T>(key:string):T|undefined;
 set<T>(key:string,value:T,ttlMs:number):void;
 delete(key:string):void;
 deletePrefix(prefix:string):void;
 deleteContaining(fragment:string):void;
 status(key:string):'HIT'|'MISS';
}

export class InMemoryTTLCache implements CacheStore{
 private items=new Map<string,CacheEntry<unknown>>();
 get<T>(key:string):T|undefined{
  const entry=this.items.get(key);
  if(!entry)return undefined;
  if(entry.expiresAt<Date.now()){this.items.delete(key);return undefined}
  return entry.value as T;
 }
 set<T>(key:string,value:T,ttlMs:number){this.items.set(key,{value,createdAt:Date.now(),expiresAt:Date.now()+ttlMs})}
 delete(key:string){this.items.delete(key)}
 deletePrefix(prefix:string){for(const key of this.items.keys())if(key.startsWith(prefix))this.items.delete(key)}
 deleteContaining(fragment:string){for(const key of this.items.keys())if(key.includes(fragment))this.items.delete(key)}
 status(key:string){return this.get(key)===undefined?'MISS':'HIT'}
}

export const cache=new InMemoryTTLCache();
export const cacheTtl={
 awsManagedCatalogue:18*60*60*1000,
 customerManagedCatalogue:2*60*1000,
 policyDetail:10*60*1000,
 riskAnalysis:18*60*60*1000
};
