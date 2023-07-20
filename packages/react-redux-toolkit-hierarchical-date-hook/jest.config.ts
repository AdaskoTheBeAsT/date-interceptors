/* eslint-disable */
export default {
  displayName: 'react-redux-toolkit-hierarchical-date-hook',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory:
    '../../coverage/packages/react-redux-toolkit-hierarchical-date-hook',
};
