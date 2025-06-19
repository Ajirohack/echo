# Contributing to Universal Translator

We welcome contributions to Universal Translator! This document provides guidelines for contributing to the project.

## 🚀 Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:

   ```bash
   git clone https://github.com/YOUR_USERNAME/MP-Translator.git
   cd MP-Translator
   ```

3. **Install dependencies**:

   ```bash
   npm install
   ```

4. **Create a feature branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Environment Setup

1. Copy `.env.example` to `.env` and configure your API keys
2. Run the development setup:

   ```bash
   npm run setup-config
   ```

3. Start the development server:

   ```bash
   npm start
   ```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 📝 Contribution Guidelines

### Code Style

- Use ESLint configuration provided in the project
- Follow JavaScript Standard Style
- Write meaningful commit messages
- Add JSDoc comments for new functions
- Maintain test coverage above 80%

### Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): description

[optional body]

[optional footer(s)]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(audio): add virtual audio device detection
fix(translation): resolve DeepL API timeout issue
docs(setup): update installation instructions
test(api): add integration tests for translation services
```

### Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** following the style guidelines
3. **Add or update tests** for your changes
4. **Run the full test suite** and ensure all tests pass
5. **Update documentation** if needed
6. **Create a pull request** with:
   - Clear title and description
   - Reference to any related issues
   - Screenshots/videos for UI changes
   - Test results and coverage

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] Added new tests for changes
- [ ] Updated existing tests

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)
```

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Environment Information**:
   - Operating System and version
   - Node.js version
   - Application version
   - Browser version (if applicable)

2. **Steps to Reproduce**:
   - Clear, numbered steps
   - Expected behavior
   - Actual behavior

3. **Additional Information**:
   - Error messages or logs
   - Screenshots or videos
   - Configuration details (without sensitive data)

**Use the bug report template:**

```markdown
**Environment:**
- OS: [e.g., Windows 11, macOS 12.6, Ubuntu 22.04]
- Node.js: [e.g., 18.17.0]
- App Version: [e.g., 1.0.0]

**Bug Description:**
A clear description of the bug.

**Steps to Reproduce:**
1. Step one
2. Step two
3. Step three

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Additional Context:**
Any other relevant information
```

## 💡 Feature Requests

Before submitting a feature request:

1. **Check existing issues** to avoid duplicates
2. **Describe the problem** you're trying to solve
3. **Propose a solution** if you have one
4. **Consider alternatives** and explain why your solution is preferred

**Feature request template:**

```markdown
**Problem Statement:**
Description of the problem or limitation

**Proposed Solution:**
Your proposed solution

**Alternatives Considered:**
Other solutions you've considered

**Additional Context:**
Mockups, examples, or other relevant information
```

## 🏗️ Development Workflow

### Branch Strategy

- `main`: Stable, production-ready code
- `develop`: Integration branch for features
- `feature/*`: Individual feature branches
- `hotfix/*`: Critical bug fixes
- `release/*`: Release preparation

### Release Process

1. Create a release branch from `develop`
2. Update version numbers and changelog
3. Run full test suite
4. Create pull request to `main`
5. Tag the release after merge
6. Deploy to production

## 🧪 Testing Guidelines

### Test Types

- **Unit Tests**: Test individual functions and modules
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete user workflows
- **Performance Tests**: Test speed and resource usage
- **Security Tests**: Test for vulnerabilities

### Writing Tests

- Test both happy path and edge cases
- Use descriptive test names
- Mock external dependencies
- Keep tests independent and isolated
- Aim for high coverage but focus on quality

### Test Structure

```javascript
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('methodName', () => {
    it('should handle normal case', () => {
      // Test implementation
    });

    it('should handle edge case', () => {
      // Test implementation
    });

    it('should throw error for invalid input', () => {
      // Test implementation
    });
  });
});
```

## 📚 Documentation

### Types of Documentation

- **API Documentation**: JSDoc comments in code
- **User Documentation**: Setup guides, tutorials
- **Developer Documentation**: Architecture, contributing
- **README**: Project overview and quick start

### Documentation Standards

- Keep documentation up-to-date with code changes
- Use clear, concise language
- Include code examples where helpful
- Add screenshots for UI-related documentation

## 🔒 Security

### Reporting Security Issues

**DO NOT** create public issues for security vulnerabilities.

Instead:

1. Email security concerns to: `security@universaltranslator.app`
2. Include detailed information about the vulnerability
3. Allow reasonable time for response before disclosure

### Security Guidelines

- Never commit API keys or secrets
- Use environment variables for sensitive data
- Follow secure coding practices
- Keep dependencies updated
- Validate all user inputs

## 🌍 Internationalization

We welcome translations and localization improvements:

1. **Adding New Languages**:
   - Add language files to `src/locales/`
   - Follow existing file structure
   - Test with different text lengths

2. **Translation Guidelines**:
   - Maintain context and meaning
   - Consider cultural differences
   - Test UI layout with translated text

## 📞 Getting Help

### Community Resources

- **GitHub Discussions**: Ask questions and share ideas
- **Discord Server**: Real-time community chat
- **Documentation**: Comprehensive guides and API docs

### Maintainer Contact

- **General Questions**: Create a GitHub Discussion
- **Bug Reports**: Create a GitHub Issue
- **Security Issues**: Email `security@universaltranslator.app`
- **Feature Requests**: Create a GitHub Issue

## 🏆 Recognition

Contributors are recognized in:

- Project README
- Release notes
- Contributors page
- Special recognition for significant contributions

## 📄 License

By contributing to Universal Translator, you agree that your contributions will be licensed under the same license as the project (MIT License).

## 🙏 Thank You

Thank you for considering contributing to Universal Translator! Your contributions help make real-time translation accessible to everyone.

---

**Happy Contributing! 🚀**
