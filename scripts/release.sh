#!/bin/bash

# Universal Translator Release Script
# Automates version bumping, tagging, and release preparation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Universal Translator Release Script"
    echo ""
    echo "Usage: $0 [version_type] [options]"
    echo ""
    echo "Version Types:"
    echo "  patch     Increment patch version (x.x.X)"
    echo "  minor     Increment minor version (x.X.x)"
    echo "  major     Increment major version (X.x.x)"
    echo "  [version] Set specific version (e.g., 1.2.3)"
    echo ""
    echo "Options:"
    echo "  --dry-run     Show what would be done without making changes"
    echo "  --skip-tests  Skip running tests before release"
    echo "  --no-push    Don't push changes to remote repository"
    echo "  --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 patch              # Bump patch version and release"
    echo "  $0 minor --dry-run    # Show what minor version bump would do"
    echo "  $0 1.5.0              # Set version to 1.5.0 and release"
    echo "  $0 major --skip-tests # Bump major version without running tests"
}

# Function to check if we're in a git repository
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository"
        exit 1
    fi
    
    # Check if working directory is clean
    if [[ -n $(git status --porcelain) ]]; then
        print_error "Working directory is not clean. Please commit or stash changes."
        git status --short
        exit 1
    fi
    
    print_success "Git repository is clean"
}

# Function to check dependencies
check_dependencies() {
    print_status "Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    # Check jq for JSON manipulation
    if ! command -v jq &> /dev/null; then
        print_warning "jq is not installed. Installing..."
        if command -v brew &> /dev/null; then
            brew install jq
        elif command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y jq
        else
            print_error "Please install jq manually"
            exit 1
        fi
    fi
    
    print_success "All dependencies are available"
}

# Function to get current version
get_current_version() {
    if [ ! -f "package.json" ]; then
        print_error "package.json not found"
        exit 1
    fi
    
    jq -r '.version' package.json
}

# Function to calculate next version
calculate_next_version() {
    local current_version=$1
    local version_type=$2
    
    # Split version into major.minor.patch
    IFS='.' read -r major minor patch <<< "$current_version"
    
    case $version_type in
        "patch")
            patch=$((patch + 1))
            ;;
        "minor")
            minor=$((minor + 1))
            patch=0
            ;;
        "major")
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        *)
            # Assume it's a specific version
            if [[ $version_type =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                echo $version_type
                return
            else
                print_error "Invalid version type: $version_type"
                show_usage
                exit 1
            fi
            ;;
    esac
    
    echo "${major}.${minor}.${patch}"
}

# Function to update version in package.json
update_package_version() {
    local new_version=$1
    
    print_status "Updating package.json version to $new_version..."
    
    if [ "$DRY_RUN" = "true" ]; then
        print_warning "[DRY RUN] Would update package.json version to $new_version"
        return
    fi
    
    # Create backup
    cp package.json package.json.bak
    
    # Update version using jq
    jq ".version = \"$new_version\"" package.json > package.json.tmp && mv package.json.tmp package.json
    
    print_success "Updated package.json version to $new_version"
}

# Function to run tests
run_tests() {
    if [ "$SKIP_TESTS" = "true" ]; then
        print_warning "Skipping tests"
        return
    fi
    
    print_status "Running tests..."
    
    if [ "$DRY_RUN" = "true" ]; then
        print_warning "[DRY RUN] Would run tests"
        return
    fi
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        npm ci
    fi
    
    # Run test suite
    npm run test:lint || {
        print_error "Linting failed"
        exit 1
    }
    
    npm run test:unit || {
        print_error "Unit tests failed"
        exit 1
    }
    
    npm run test:integration || {
        print_warning "Integration tests failed (continuing anyway)"
    }
    
    print_success "Tests completed successfully"
}

# Function to build application
build_application() {
    print_status "Building application..."
    
    if [ "$DRY_RUN" = "true" ]; then
        print_warning "[DRY RUN] Would build application"
        return
    fi
    
    # Run the build script
    if [ -f "scripts/build.sh" ]; then
        chmod +x scripts/build.sh
        ./scripts/build.sh --skip-tests
    else
        print_warning "Build script not found, running basic build"
        npm run build-dev || {
            print_error "Build failed"
            exit 1
        }
    fi
    
    print_success "Application built successfully"
}

# Function to generate changelog
generate_changelog() {
    local current_version=$1
    local new_version=$2
    
    print_status "Generating changelog for version $new_version..."
    
    if [ "$DRY_RUN" = "true" ]; then
        print_warning "[DRY RUN] Would generate changelog"
        return
    fi
    
    # Get commit messages since last tag
    local last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    local commit_range=""
    
    if [ -n "$last_tag" ]; then
        commit_range="${last_tag}..HEAD"
    else
        commit_range="HEAD"
    fi
    
    # Generate changelog entry
    local changelog_entry="## [$new_version] - $(date +'%Y-%m-%d')\n\n"
    
    # Get commits and categorize them
    local features=$(git log $commit_range --oneline --grep="feat:" --grep="feature:" | sed 's/^[a-f0-9]* /- /')
    local fixes=$(git log $commit_range --oneline --grep="fix:" --grep="bug:" | sed 's/^[a-f0-9]* /- /')
    local improvements=$(git log $commit_range --oneline --grep="improve:" --grep="enhance:" | sed 's/^[a-f0-9]* /- /')
    
    if [ -n "$features" ]; then
        changelog_entry="${changelog_entry}### Features\n$features\n\n"
    fi
    
    if [ -n "$fixes" ]; then
        changelog_entry="${changelog_entry}### Bug Fixes\n$fixes\n\n"
    fi
    
    if [ -n "$improvements" ]; then
        changelog_entry="${changelog_entry}### Improvements\n$improvements\n\n"
    fi
    
    # Create or update CHANGELOG.md
    if [ -f "CHANGELOG.md" ]; then
        # Insert new entry at the top (after the header)
        {
            head -n 2 CHANGELOG.md
            echo -e "$changelog_entry"
            tail -n +3 CHANGELOG.md
        } > CHANGELOG.tmp && mv CHANGELOG.tmp CHANGELOG.md
    else
        # Create new changelog
        echo -e "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n$changelog_entry" > CHANGELOG.md
    fi
    
    print_success "Changelog generated"
}

# Function to commit and tag
commit_and_tag() {
    local new_version=$1
    
    print_status "Committing changes and creating tag..."
    
    if [ "$DRY_RUN" = "true" ]; then
        print_warning "[DRY RUN] Would commit and tag version $new_version"
        return
    fi
    
    # Add changed files
    git add package.json
    [ -f "CHANGELOG.md" ] && git add CHANGELOG.md
    
    # Commit
    git commit -m "chore(release): bump version to $new_version"
    
    # Create tag
    git tag -a "v$new_version" -m "Release version $new_version"
    
    print_success "Created commit and tag for version $new_version"
}

# Function to push changes
push_changes() {
    local new_version=$1
    
    if [ "$NO_PUSH" = "true" ]; then
        print_warning "Skipping push (--no-push flag set)"
        return
    fi
    
    print_status "Pushing changes to remote repository..."
    
    if [ "$DRY_RUN" = "true" ]; then
        print_warning "[DRY RUN] Would push commit and tag v$new_version"
        return
    fi
    
    # Push commit
    git push origin main || git push origin master || {
        print_error "Failed to push commits"
        exit 1
    }
    
    # Push tag
    git push origin "v$new_version" || {
        print_error "Failed to push tag"
        exit 1
    }
    
    print_success "Pushed changes and tag to remote repository"
}

# Function to show release summary
show_summary() {
    local current_version=$1
    local new_version=$2
    
    echo ""
    echo "🎉 Release Summary"
    echo "=================="
    echo "Previous version: $current_version"
    echo "New version:      $new_version"
    echo "Tag:              v$new_version"
    echo ""
    echo "Next steps:"
    echo "1. Monitor the CI/CD pipeline"
    echo "2. Test the built packages"
    echo "3. Update documentation if needed"
    echo "4. Announce the release"
    echo ""
    echo "GitHub Release: https://github.com/your-repo/universal-translator/releases/tag/v$new_version"
    echo ""
}

# Main release function
main() {
    local version_type=$1
    
    # Check arguments
    if [ -z "$version_type" ]; then
        print_error "Version type is required"
        show_usage
        exit 1
    fi
    
    # Pre-flight checks
    check_git_repo
    check_dependencies
    
    # Get current version
    local current_version=$(get_current_version)
    print_status "Current version: $current_version"
    
    # Calculate new version
    local new_version=$(calculate_next_version "$current_version" "$version_type")
    print_status "New version: $new_version"
    
    # Confirm release
    if [ "$DRY_RUN" != "true" ]; then
        echo ""
        echo -e "${YELLOW}About to release Universal Translator v$new_version${NC}"
        echo "This will:"
        echo "- Update package.json version"
        echo "- Run tests (unless --skip-tests)"
        echo "- Build the application"
        echo "- Generate changelog"
        echo "- Commit changes"
        echo "- Create and push git tag"
        echo ""
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_warning "Release cancelled"
            exit 0
        fi
    fi
    
    # Execute release steps
    update_package_version "$new_version"
    run_tests
    build_application
    generate_changelog "$current_version" "$new_version"
    commit_and_tag "$new_version"
    push_changes "$new_version"
    
    # Show summary
    show_summary "$current_version" "$new_version"
    
    if [ "$DRY_RUN" = "true" ]; then
        print_warning "This was a dry run. No changes were made."
    else
        print_success "Release v$new_version completed successfully!"
    fi
}

# Parse command line arguments
DRY_RUN=false
SKIP_TESTS=false
NO_PUSH=false
VERSION_TYPE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --no-push)
            NO_PUSH=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        -*)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
        *)
            if [ -z "$VERSION_TYPE" ]; then
                VERSION_TYPE=$1
            else
                print_error "Multiple version types specified"
                show_usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Run main function
main "$VERSION_TYPE"
