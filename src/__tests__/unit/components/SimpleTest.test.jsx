import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

test('simple test', () => {
  render(<div>Test</div>);
  expect(screen.getByText('Test')).toBeInTheDocument();
});
