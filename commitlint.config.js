export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100], // En-tête plus long
    'body-max-line-length': [2, 'always', Infinity], // Corps plus long
    'footer-max-line-length': [2, 'always', Infinity], // Pied de page plus long
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'test',
        'chore',
        'perf',
        'ci',
        'build',
        'revert',
      ],
    ],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case']],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
  },
}
