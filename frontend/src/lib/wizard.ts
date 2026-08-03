export function canOpenWizardStep(step:number,maxUnlocked:number){
 return step>=1&&step<=maxUnlocked;
}

export function unlockNextWizardStep(currentStep:number,maxUnlocked:number,totalSteps:number){
 const next=Math.min(totalSteps,currentStep+1);
 return {nextStep:next,nextMaxUnlocked:Math.max(maxUnlocked,next)};
}

export function shouldShowScheduledStartInput(mode:'after-approval'|'scheduled'){
 return mode==='scheduled';
}
