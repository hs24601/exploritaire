/** Shared AP cost marker for ability card faces. */
export function AbilityCostBubble({cost, owner='Hero'}:{cost:number;owner?:string}) {
  return <span className="ability-fan__cost ability-fan__cost--ap" role="img" aria-label={`${cost} ${owner} AP`}><span className="ability-fan__ap-label" aria-hidden="true">AP</span><span className="ability-fan__cost-value" aria-hidden="true">{cost}</span></span>;
}
