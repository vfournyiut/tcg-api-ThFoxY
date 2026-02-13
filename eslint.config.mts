import tseslint from 'typescript-eslint';

export default tseslint.config(
    tseslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            // Vos règles personnalisées
            eqeqeq: ['error', 'always'], // Test des égalités strictes
            'prefer-const': ['error', { destructuring: 'all' }], // Préfère les constantes quand elles ne sont pas réassignées
            'no-useless-rename': 'error', // Interdit les renommages inutiles dans les importations, exportations et destructurations
            'no-useless-constructor': 'error', // Interdit les constructeurs inutiles
            'no-console': 'off', // Permet l'utilisation de console.log pour le développement
            'no-debugger': 'error', // Interdit l'utilisation de debugger
            'no-throw-literal': 'error', // Interdit de lancer des littéraux (ex: throw "error") au lieu d'instances d'Error
            'no-unused-expressions': 'error', // Interdit les expressions inutilisées (ex: x + 1; sans l'assigner ou l'utiliser)
            'no-var': 'error', // Interdit l'utilisation de var, préférer let ou const
            'no-redeclare': 'error', // Interdit la redéclaration de variables, fonctions ou classes
            'no-const-assign': 'error', // Interdit de réassigner des variables déclarées avec const
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_', // Ignore les variables d'arguments qui commencent par un underscore
                    varsIgnorePattern: '^_', // Ignore les variables qui commencent par un underscore
                    caughtErrorsIgnorePattern: '^_', // Ignore les erreurs capturées qui commencent par un underscore
                },
            ],
            '@typescript-eslint/no-explicit-any': 'warn',
            'prettier/prettier': 'error',
        },
    },
    {
        ignores: ['node_modules', 'dist', 'build'],
    },
);
