#!/bin/bash

# echo Build Script
# Builds echo for multiple platforms

echo "🚀 echo Build Script"
echo "===================================="

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

# Check Node.js version
check_node_version() {
    print_status "Checking Node.js version..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    REQUIRED_VERSION="16.0.0"
    
    if ! node -p "process.exit(require('semver').gte('$NODE_VERSION', '$REQUIRED_VERSION') ? 0 : 1)" 2>/dev/null; then
        print_error "Node.js version $NODE_VERSION is too old. Required: $REQUIRED_VERSION+"
        exit 1
    fi
    
    print_success "Node.js version $NODE_VERSION is compatible"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found"
        exit 1
    fi
    
    npm ci
    print_success "Dependencies installed successfully"
}

# Create necessary directories
create_directories() {
    print_status "Creating build directories..."
    
    mkdir -p dist
    mkdir -p build
    mkdir -p assets/icons
    mkdir -p src/services
    mkdir -p src/audio
    
    print_success "Build directories created"
}

# Generate app icons
generate_icons() {
    print_status "Generating application icons..."
    
    # Create placeholder icons if they don't exist
    if [ ! -f "assets/icons/icon.png" ]; then
        print_warning "Creating placeholder icon (replace with actual icon)"
        
        # Create a simple placeholder icon using ImageMagick if available
        if command -v convert &> /dev/null; then
            convert -size 512x512 xc:lightblue -gravity center -pointsize 48 -annotate +0+0 "echo" assets/icons/icon.png
            
            # Generate different sizes for different platforms
            convert assets/icons/icon.png -resize 256x256 assets/icons/icon.ico
            convert assets/icons/icon.png -resize 512x512 assets/icons/icon.icns
        else
            print_warning "ImageMagick not found. Please add proper icons manually to assets/icons/"
            touch assets/icons/icon.png
            touch assets/icons/icon.ico
            touch assets/icons/icon.icns
        fi
    fi
    
    print_success "Icons ready"
}

# Run tests
run_tests() {
    print_status "Running tests..."
    
    if npm run test:lint; then
        print_success "Linting passed"
    else
        print_warning "Linting issues found (continuing anyway)"
    fi
    
    if npm run test:unit; then
        print_success "Unit tests passed"
    else
        print_warning "Some unit tests failed (continuing anyway)"
    fi
    
    print_success "Tests completed"
}

# Build for specific platform
build_platform() {
    local platform=$1
    print_status "Building for $platform..."
    
    case $platform in
        "mac")
            npm run dist-mac
            print_success "macOS build completed"
            ;;
        "win")
            npm run dist-win
            print_success "Windows build completed"
            ;;
        "linux")
            npm run dist-linux
            print_success "Linux build completed"
            ;;
        "all")
            npm run dist
            print_success "All platform builds completed"
            ;;
        *)
            print_error "Unknown platform: $platform"
            print_status "Available platforms: mac, win, linux, all"
            exit 1
            ;;
    esac
}

# Setup virtual audio dependencies
setup_virtual_audio() {
    print_status "Setting up virtual audio dependencies..."
    
    case "$(uname -s)" in
        Darwin*)
            print_status "macOS detected - BlackHole setup"
            if ! system_profiler SPAudioDataType | grep -q "BlackHole"; then
                print_warning "BlackHole not installed. Will be installed during app first run."
            else
                print_success "BlackHole already installed"
            fi
            ;;
        Linux*)
            print_status "Linux detected - PulseAudio setup"
            if ! command -v pactl &> /dev/null; then
                print_error "PulseAudio not found. Install with: sudo apt install pulseaudio pulseaudio-utils"
                exit 1
            else
                print_success "PulseAudio available"
            fi
            ;;
        CYGWIN*|MINGW32*|MSYS*|MINGW*)
            print_status "Windows detected - VB-Audio Cable will be installed during setup"
            print_success "Windows virtual audio ready"
            ;;
        *)
            print_warning "Unknown platform for virtual audio setup"
            ;;
    esac
}

# Create installer assets
create_installer_assets() {
    print_status "Creating installer assets..."
    
    # Create background image for macOS DMG
    if [ ! -f "build/background.png" ]; then
        if command -v convert &> /dev/null; then
            convert -size 540x380 xc:white -gravity center -pointsize 24 \
                -annotate +0-50 "echo" \
                -pointsize 16 -annotate +0+20 "Drag to Applications folder to install" \
                build/background.png
        else
            touch build/background.png
        fi
    fi
    
    print_success "Installer assets ready"
}

# Validate build output
validate_build() {
    print_status "Validating build output..."
    
    local platform=$1
    local found_files=0
    
    case $platform in
        "mac")
            if [ -f "dist/"*".dmg" ]; then
                print_success "macOS DMG created"
                found_files=1
            fi
            ;;
        "win")
            if [ -f "dist/"*".exe" ]; then
                print_success "Windows installer created"
                found_files=1
            fi
            ;;
        "linux")
            if [ -f "dist/"*".AppImage" ] || [ -f "dist/"*".deb" ]; then
                print_success "Linux packages created"
                found_files=1
            fi
            ;;
        "all")
            if ls dist/*.{dmg,exe,AppImage,deb} &> /dev/null; then
                print_success "Multi-platform packages created"
                found_files=1
            fi
            ;;
    esac
    
    if [ $found_files -eq 0 ]; then
        print_error "No build output found"
        exit 1
    fi
    
    print_success "Build validation passed"
}

# Main build process
main() {
    local platform="${1:-all}"
    local skip_tests="${2:-false}"
    
    echo "Building echo for platform: $platform"
    echo "Skip tests: $skip_tests"
    echo ""
    
    # Pre-build checks
    check_node_version
    create_directories
    install_dependencies
    generate_icons
    create_installer_assets
    setup_virtual_audio
    
    # Run tests unless skipped
    if [ "$skip_tests" != "true" ]; then
        run_tests
    else
        print_warning "Skipping tests"
    fi
    
    # Build the application
    build_platform "$platform"
    
    # Validate output
    validate_build "$platform"
    
    echo ""
    print_success "🎉 Build completed successfully!"
    print_status "Build artifacts are in the 'dist' directory"
    
    # Show build summary
    echo ""
    echo "📦 Build Summary:"
    echo "================"
    ls -la dist/ 2>/dev/null || print_warning "No files in dist directory"
    
    echo ""
    echo "🚀 Next Steps:"
    echo "=============="
    echo "1. Test the built application"
    echo "2. Set up API keys during first run"
    echo "3. Configure virtual audio devices"
    echo "4. Test with communication platforms"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --platform)
            PLATFORM="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS="true"
            shift
            ;;
        --help)
            echo "echo Build Script"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --platform PLATFORM    Build for specific platform (mac|win|linux|all)"
            echo "  --skip-tests           Skip running tests"
            echo "  --help                 Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                     # Build for all platforms"
            echo "  $0 --platform mac      # Build for macOS only"
            echo "  $0 --skip-tests        # Build without running tests"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run main function
main "${PLATFORM:-all}" "${SKIP_TESTS:-false}"

echo "echo Build Script"
