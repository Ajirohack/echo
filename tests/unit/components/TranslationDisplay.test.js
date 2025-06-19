/**
 * Unit tests for TranslationDisplay component
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { JSDOM } = require('jsdom');
const React = require('react');
const { render, screen, fireEvent, cleanup } = require('@testing-library/react');

// Mock React component
const TranslationDisplay = require('../../../src/components/TranslationDisplay');

describe('TranslationDisplay Component', () => {
    let sandbox;

    // Set up DOM environment
    before(() => {
        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
        global.window = dom.window;
        global.document = dom.window.document;
        global.navigator = dom.window.navigator;
    });

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
        cleanup();
    });

    it('should render original and translated text', () => {
        const props = {
            original: 'Hello world',
            translation: 'Hola mundo',
            sourceLang: 'en',
            targetLang: 'es',
            service: 'deepl'
        };

        render(<TranslationDisplay {...props} />);

        expect(screen.getByText(props.original)).to.exist;
        expect(screen.getByText(props.translation)).to.exist;
    });

    it('should show loading state while translating', () => {
        const props = {
            loading: true,
            original: 'Hello world',
            translation: '',
            sourceLang: 'en',
            targetLang: 'es'
        };

        render(<TranslationDisplay {...props} />);

        // Should show loading indicator
        expect(screen.getByTestId('loading-indicator')).to.exist;
    });

    it('should display service information', () => {
        const props = {
            original: 'Hello world',
            translation: 'Hola mundo',
            sourceLang: 'en',
            targetLang: 'es',
            service: 'deepl',
            showServiceInfo: true
        };

        render(<TranslationDisplay {...props} />);

        // Should show service name
        expect(screen.getByText(/deepl/i)).to.exist;
    });

    it('should trigger copyToClipboard when copy button is clicked', () => {
        const copyStub = sandbox.stub();
        global.navigator.clipboard = { writeText: copyStub };

        const props = {
            original: 'Hello world',
            translation: 'Hola mundo',
            sourceLang: 'en',
            targetLang: 'es',
            service: 'deepl'
        };

        render(<TranslationDisplay {...props} />);

        // Click copy button
        fireEvent.click(screen.getByTestId('copy-button'));

        // Should call clipboard API
        expect(copyStub.calledOnce).to.be.true;
        expect(copyStub.calledWith('Hola mundo')).to.be.true;
    });

    it('should display error message when there is an error', () => {
        const props = {
            original: 'Hello world',
            error: 'Translation service unavailable',
            sourceLang: 'en',
            targetLang: 'es'
        };

        render(<TranslationDisplay {...props} />);

        // Should show error message
        expect(screen.getByText(/Translation service unavailable/i)).to.exist;
    });

    it('should render language names instead of codes when showLanguageNames is true', () => {
        const props = {
            original: 'Hello world',
            translation: 'Hola mundo',
            sourceLang: 'en',
            targetLang: 'es',
            service: 'deepl',
            showLanguageNames: true
        };

        render(<TranslationDisplay {...props} />);

        // Should show language names
        expect(screen.getByText(/English/i)).to.exist;
        expect(screen.getByText(/Spanish/i)).to.exist;
    });

    it('should allow editing translation when editable is true', () => {
        const onEditSpy = sandbox.spy();

        const props = {
            original: 'Hello world',
            translation: 'Hola mundo',
            sourceLang: 'en',
            targetLang: 'es',
            service: 'deepl',
            editable: true,
            onEdit: onEditSpy
        };

        render(<TranslationDisplay {...props} />);

        // Find editable area
        const editableArea = screen.getByTestId('editable-translation');

        // Edit translation
        fireEvent.input(editableArea, {
            target: { textContent: 'Hola mundo editado' }
        });

        // Blur to trigger save
        fireEvent.blur(editableArea);

        // Should call onEdit with new value
        expect(onEditSpy.calledOnce).to.be.true;
        expect(onEditSpy.calledWith('Hola mundo editado')).to.be.true;
    });
});
