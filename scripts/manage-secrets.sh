#!/bin/bash

# Secrets Management Script for ML Agent
# Production-ready secrets handling with encryption

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
VAULT_FILE=".env.vault"
ENV_FILE=".env.production"
ENCRYPTED_FILE=".env.production.enc"

# Function to check dependencies
check_dependencies() {
    local deps=("openssl" "jq")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            echo -e "${RED}Error: $dep is not installed${NC}"
            exit 1
        fi
    done
}

# Function to generate secure random secrets
generate_secret() {
    openssl rand -base64 32
}

# Function to encrypt secrets file
encrypt_secrets() {
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}Error: $ENV_FILE not found${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Enter encryption password:${NC}"
    openssl aes-256-cbc -salt -in "$ENV_FILE" -out "$ENCRYPTED_FILE" -pbkdf2
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Secrets encrypted successfully to $ENCRYPTED_FILE${NC}"
        # Remove unencrypted file
        rm -f "$ENV_FILE"
        echo -e "${GREEN}Unencrypted file removed${NC}"
    else
        echo -e "${RED}Encryption failed${NC}"
        exit 1
    fi
}

# Function to decrypt secrets file
decrypt_secrets() {
    if [ ! -f "$ENCRYPTED_FILE" ]; then
        echo -e "${RED}Error: $ENCRYPTED_FILE not found${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Enter decryption password:${NC}"
    openssl aes-256-cbc -d -salt -in "$ENCRYPTED_FILE" -out "$ENV_FILE" -pbkdf2
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Secrets decrypted successfully to $ENV_FILE${NC}"
        # Set restrictive permissions
        chmod 600 "$ENV_FILE"
    else
        echo -e "${RED}Decryption failed${NC}"
        exit 1
    fi
}

# Function to rotate secrets
rotate_secrets() {
    echo -e "${YELLOW}Rotating secrets...${NC}"
    
    # Decrypt current secrets
    decrypt_secrets
    
    # Generate new secrets
    NEW_ENCRYPTION_KEY=$(generate_secret)
    NEW_SESSION_SECRET=$(generate_secret)
    NEW_NEXTAUTH_SECRET=$(generate_secret)
    
    # Update .env file
    sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$NEW_ENCRYPTION_KEY/" "$ENV_FILE"
    sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$NEW_SESSION_SECRET/" "$ENV_FILE"
    sed -i "s/NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=$NEW_NEXTAUTH_SECRET/" "$ENV_FILE"
    
    echo -e "${GREEN}Secrets rotated successfully${NC}"
    
    # Re-encrypt
    encrypt_secrets
}

# Function to verify secrets
verify_secrets() {
    if [ ! -f "$ENCRYPTED_FILE" ]; then
        echo -e "${RED}Error: No encrypted secrets found${NC}"
        exit 1
    fi
    
    # Temporarily decrypt to verify
    decrypt_secrets
    
    # Check required variables
    required_vars=(
        "DATABASE_URL"
        "REDIS_URL"
        "ENCRYPTION_KEY"
        "ML_CLIENT_ID"
        "ML_CLIENT_SECRET"
    )
    
    missing=()
    while IFS= read -r line; do
        if [[ ! "$line" =~ ^# ]] && [[ "$line" =~ ^[A-Z_]+= ]]; then
            var_name=$(echo "$line" | cut -d'=' -f1)
            var_value=$(echo "$line" | cut -d'=' -f2-)
            
            if [[ -z "$var_value" ]] || [[ "$var_value" == "\${*}" ]]; then
                missing+=("$var_name")
            fi
        fi
    done < "$ENV_FILE"
    
    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}Missing or placeholder secrets:${NC}"
        printf '%s\n' "${missing[@]}"
        rm -f "$ENV_FILE"
        exit 1
    else
        echo -e "${GREEN}All required secrets are configured${NC}"
    fi
    
    # Re-encrypt
    encrypt_secrets
}

# Function to setup GitHub secrets
setup_github_secrets() {
    echo -e "${YELLOW}Setting up GitHub Secrets...${NC}"
    
    # Check if gh CLI is installed
    if ! command -v gh &> /dev/null; then
        echo -e "${RED}GitHub CLI (gh) is not installed${NC}"
        echo "Install from: https://cli.github.com/"
        exit 1
    fi
    
    # Decrypt secrets
    decrypt_secrets
    
    # Read secrets and set in GitHub
    while IFS= read -r line; do
        if [[ ! "$line" =~ ^# ]] && [[ "$line" =~ ^[A-Z_]+= ]]; then
            var_name=$(echo "$line" | cut -d'=' -f1)
            var_value=$(echo "$line" | cut -d'=' -f2-)
            
            if [[ ! "$var_value" == "\${*}" ]]; then
                echo "Setting secret: $var_name"
                echo "$var_value" | gh secret set "$var_name"
            fi
        fi
    done < "$ENV_FILE"
    
    echo -e "${GREEN}GitHub Secrets configured${NC}"
    
    # Re-encrypt
    encrypt_secrets
}

# Main menu
main() {
    check_dependencies
    
    echo -e "${GREEN}ML Agent Secrets Management${NC}"
    echo "1. Encrypt secrets"
    echo "2. Decrypt secrets"
    echo "3. Rotate secrets"
    echo "4. Verify secrets"
    echo "5. Setup GitHub secrets"
    echo "6. Exit"
    
    read -p "Select option: " option
    
    case $option in
        1) encrypt_secrets ;;
        2) decrypt_secrets ;;
        3) rotate_secrets ;;
        4) verify_secrets ;;
        5) setup_github_secrets ;;
        6) exit 0 ;;
        *) echo -e "${RED}Invalid option${NC}" && exit 1 ;;
    esac
}

# Run main function
main "$@"