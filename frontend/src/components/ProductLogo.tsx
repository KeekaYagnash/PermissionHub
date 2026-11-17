/** Supplied artwork, unchanged. CSS frames out only its transparent canvas margins. */
export function ProductLogo(){
 return <span className="product-logo">
  <img className="product-logo-light" src="/iamops_black.png" alt="IAMOps" width={3000} height={3000}/>
  <img className="product-logo-dark" src="/iamops_white.png" alt="IAMOps" width={3000} height={3000}/>
 </span>;
}
