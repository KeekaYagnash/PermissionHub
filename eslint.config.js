import tseslint from 'typescript-eslint';

export default tseslint.config(
 {ignores:['**/dist/**','**/node_modules/**','frontend/src/**/*.test.ts','backend/src/**/*.test.ts']},
 ...tseslint.configs.recommended,
 {files:['**/*.ts','**/*.tsx'],rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':['warn',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}],'@typescript-eslint/no-empty-object-type':'off'}}
);
