try {
  if (process.env.TAKOMI_SUPPRESS_POSTINSTALL === '1') process.exit(0);
  if (process.env.CI === 'true' || process.env.CI === '1') process.exit(0);

  const lines = [
    '',
    '🎯 Takomi installed.',
    '',
    'Recommended next steps:',
    '  takomi setup pi          Set up the Pi-native Takomi harness',
    '  takomi setup pi-features Add optional Pi feature packs',
    '  takomi setup skills      Install global Takomi skills',
    '  takomi setup all         Set up Pi + skills',
    '',
    'Useful commands:',
    '  takomi doctor            Check installation health',
    '  takomi status            Show connected harnesses/toolkit status',
    '  takomi refresh           Update Takomi, Pi assets, skills, and Pi packages',
    '  takomi --help            Show all commands',
    '',
    'Then run `takomi` from inside a project.',
    '',
  ];
  console.log(lines.join('\n'));
} catch {
  // Postinstall guidance must never break package installation.
}
