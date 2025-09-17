import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TestComponent from '../../../src/components/TestComponent';

describe('TestComponent', () => {
  test('renders without crashing', () => {
    render(<TestComponent />);
    expect(screen.getByText('Test Component')).toBeInTheDocument();
  });
});
