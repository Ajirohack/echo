# API Setup Guide

## Overview

This guide walks you through setting up API keys for the various translation and speech services supported by Universal Translator.

## Translation Services

### DeepL API (Recommended for European Languages)

DeepL provides high-quality translations, especially for European languages.

#### Getting DeepL API Key

1. **Visit DeepL Pro**: Go to [www.deepl.com/pro](https://www.deepl.com/pro)
2. **Create Account**: Sign up for a DeepL Pro account
3. **Choose Plan**:
   - **DeepL API Free**: 500,000 characters/month free
   - **DeepL API Pro**: Starting at $6.99/month for 1M characters
4. **Get API Key**:
   - Go to your account settings
   - Navigate to "API Keys" section
   - Generate a new API key
   - Copy the key (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

#### Configuring DeepL in Universal Translator

1. Open Universal Translator
2. Go to Settings > Translation Services
3. Select DeepL tab
4. Paste your API key
5. Test connection
6. Set as primary service (recommended for EU languages)

### OpenAI GPT-4o API (Best for Context-Aware Translation)

GPT-4o provides excellent context-aware translations and handles idioms well.

#### Getting OpenAI API Key

1. **Visit OpenAI**: Go to [platform.openai.com](https://platform.openai.com)
2. **Create Account**: Sign up for an OpenAI account
3. **Billing Setup**: Add payment method (pay-per-use pricing)
4. **Generate API Key**:
   - Go to API Keys section
   - Click "Create new secret key"
   - Copy the key (format: `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
   - **Important**: Store this key securely, it won't be shown again

#### Pricing Information

- **GPT-4o**: $0.03 per 1K tokens input, $0.06 per 1K tokens output
- **GPT-4o Mini**: $0.15 per 1M tokens input, $0.6 per 1M tokens output
- Typical translation: 10-50 tokens per sentence

#### Configuring OpenAI in Universal Translator

1. Open Universal Translator
2. Go to Settings > Translation Services
3. Select OpenAI tab
4. Paste your API key
5. Choose model (GPT-4o recommended)
6. Set context window size
7. Test connection

### Google Translate API (Fast and Reliable)

Google Translate offers fast translations with good coverage of languages.

#### Getting Google Translate API Key

1. **Google Cloud Console**: Go to [console.cloud.google.com](https://console.cloud.google.com)
2. **Create Project**: Create a new project or select existing
3. **Enable API**:
   - Go to APIs & Services > Library
   - Search for "Cloud Translation API"
   - Enable the API
4. **Create Credentials**:
   - Go to APIs & Services > Credentials
   - Click "Create Credentials" > "API Key"
   - Copy the API key
   - (Optional) Restrict the key to Translation API only

#### Pricing Information

- **Standard Edition**: $20 per 1M characters
- **Advanced Edition**: $20 per 1M characters (additional features)
- Free tier: $300 credit for new users

#### Configuring Google Translate in Universal Translator

1. Open Universal Translator
2. Go to Settings > Translation Services
3. Select Google Translate tab
4. Paste your API key
5. Choose edition (Standard/Advanced)
6. Test connection

### Azure Translator (Enterprise-Grade)

Microsoft Azure Translator provides enterprise-grade translation with high reliability.

#### Getting Azure Translator API Key

1. **Azure Portal**: Go to [portal.azure.com](https://portal.azure.com)
2. **Create Resource**: Create new "Translator" resource
3. **Configure Resource**:
   - Select subscription
   - Create resource group
   - Choose region
   - Select pricing tier
4. **Get API Key**:
   - Go to resource overview
   - Click "Keys and Endpoint"
   - Copy Key 1 and Endpoint URL

#### Pricing Information

- **Free Tier**: 2M characters/month
- **Standard**: $10 per 1M characters
- **Premium**: Custom pricing for high volume

#### Configuring Azure Translator in Universal Translator

1. Open Universal Translator
2. Go to Settings > Translation Services
3. Select Azure Translator tab
4. Enter API key and endpoint
5. Select region
6. Test connection

## Speech Services

### Azure Speech Services (Recommended)

Azure Speech Services provides high-quality speech-to-text and text-to-speech.

#### Getting Azure Speech API Key

1. **Azure Portal**: Go to [portal.azure.com](https://portal.azure.com)
2. **Create Resource**: Create new "Speech" resource
3. **Configure Resource**:
   - Select subscription
   - Create resource group
   - Choose region (closer to you for lower latency)
   - Select pricing tier
4. **Get API Key**:
   - Go to resource overview
   - Click "Keys and Endpoint"
   - Copy Key 1 and Region

#### Pricing Information

- **Free Tier**: 5 hours audio/month for STT, 0.5M characters/month for TTS
- **Standard**: $1 per hour for STT, $16 per 1M characters for TTS

#### Configuring Azure Speech in Universal Translator

1. Open Universal Translator
2. Go to Settings > Speech Services
3. Select Azure Speech tab
4. Enter API key and region
5. Choose voice models
6. Test both STT and TTS

### Google Cloud Speech-to-Text

Google's speech recognition service with good accuracy.

#### Getting Google Cloud Speech API Key

1. **Google Cloud Console**: Go to [console.cloud.google.com](https://console.cloud.google.com)
2. **Create Project**: Create new project or select existing
3. **Enable APIs**:
   - Cloud Speech-to-Text API
   - Cloud Text-to-Speech API (optional)
4. **Create Service Account**:
   - Go to IAM & Admin > Service Accounts
   - Create new service account
   - Download JSON key file
5. **Set Environment Variable**:

   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="path/to/your/keyfile.json"
   ```

#### Configuring Google Cloud Speech in Universal Translator

1. Open Universal Translator
2. Go to Settings > Speech Services
3. Select Google Cloud Speech tab
4. Upload JSON key file or set credentials path
5. Test connection

## Security Best Practices

### API Key Security

1. **Never Share API Keys**: Don't commit keys to version control
2. **Use Environment Variables**: Store keys in environment variables
3. **Rotate Keys Regularly**: Change keys every 90 days
4. **Monitor Usage**: Check for unexpected API usage
5. **Set Usage Limits**: Configure spending limits where possible

### Universal Translator Security

1. **Encrypted Storage**: All API keys are encrypted locally
2. **No Cloud Storage**: Keys never leave your device
3. **Secure Transmission**: All API calls use HTTPS
4. **Local Processing**: Audio processing happens locally when possible

## Testing Your Setup

### Connection Test

1. Open Universal Translator
2. Go to Settings > Services Status
3. Click "Test All Connections"
4. Verify all services show "Connected"

### Translation Test

1. Go to main translation interface
2. Select source and target languages
3. Enter test text: "Hello, how are you today?"
4. Click translate
5. Verify translation appears and sounds correct

### Audio Test

1. Go to Settings > Audio
2. Click "Test Microphone"
3. Speak for 5 seconds
4. Verify audio is captured and transcribed
5. Test text-to-speech output

## Troubleshooting API Issues

### Common Error Messages

#### "Invalid API Key"

- **Cause**: Incorrect or expired API key
- **Solution**: Verify key is copied correctly, check expiration
- **Check**: API key format matches service requirements

#### "Quota Exceeded"

- **Cause**: Monthly usage limit reached
- **Solution**: Wait for quota reset or upgrade plan
- **Prevention**: Monitor usage in service dashboards

#### "Service Unavailable"

- **Cause**: Temporary service outage
- **Solution**: Wait and retry, check service status pages
- **Workaround**: Switch to alternative service

#### "Authentication Failed"

- **Cause**: Incorrect credentials or configuration
- **Solution**: Verify all required fields are filled
- **Check**: Region, endpoint, and other service-specific settings

### Service-Specific Troubleshooting

#### DeepL Issues

- **Check**: API key format (with hyphens)
- **Verify**: Account has available character quota
- **Test**: API key works in DeepL's API tester

#### OpenAI Issues

- **Check**: API key starts with "sk-"
- **Verify**: Billing is set up and has available credits
- **Test**: Key works in OpenAI Playground

#### Google Issues

- **Check**: All required APIs are enabled
- **Verify**: Service account has proper permissions
- **Test**: JSON key file is valid and accessible

#### Azure Issues

- **Check**: Key and endpoint are from same resource
- **Verify**: Region is specified correctly
- **Test**: Resource is active and not suspended

## Advanced Configuration

### Custom Endpoints

Some services allow custom endpoints for enterprise deployments:

1. Go to Settings > Advanced
2. Enable "Custom Endpoints"
3. Enter your custom endpoint URLs
4. Configure authentication as required

### Batch Processing

For high-volume usage:

1. Enable batch processing in Settings
2. Configure batch size and interval
3. Monitor performance impact
4. Adjust based on your usage patterns

### Failover Configuration

Set up service failover for reliability:

1. Configure multiple services for same language pairs
2. Set priority order in Settings > Failover
3. Configure timeout and retry settings
4. Test failover behavior

## Cost Optimization

### Usage Monitoring

1. **Dashboard**: Use service provider dashboards to monitor usage
2. **Alerts**: Set up billing alerts for unexpected usage
3. **Reporting**: Review monthly usage reports
4. **Optimization**: Identify and optimize high-usage scenarios

### Cost-Saving Tips

1. **Choose Appropriate Services**: Use faster/cheaper services for simple text
2. **Batch Requests**: Combine multiple translations when possible
3. **Cache Results**: Enable translation caching for repeated phrases
4. **Optimize Audio**: Use appropriate audio quality settings
5. **Language Detection**: Use auto-detection sparingly

## Support Resources

### Official Documentation

- **DeepL**: [deepl.com/docs-api](https://www.deepl.com/docs-api)
- **OpenAI**: [platform.openai.com/docs](https://platform.openai.com/docs)
- **Google**: [cloud.google.com/translate/docs](https://cloud.google.com/translate/docs)
- **Azure**: [docs.microsoft.com/azure/cognitive-services/translator](https://docs.microsoft.com/en-us/azure/cognitive-services/translator/)

### Community Support

- **Universal Translator Discord**: [discord.gg/universaltranslator](#)
- **GitHub Issues**: [github.com/your-repo/universal-translator/issues](#)
- **Community Wiki**: [wiki.universaltranslator.app](#)

### Professional Support

For enterprise deployments:

- **Consulting**: Setup and configuration assistance
- **Training**: Team training on best practices
- **Custom Integration**: API integration for specific workflows
- **24/7 Support**: Priority support for critical deployments

Contact: <enterprise@universaltranslator.app>
