const fs = require('fs').promises;
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '../../../data/config');

const CONFIG_DEFINITIONS = {
  app: {
    file: 'app_config.json'
  },
  notify: {
    file: 'notify_config.json'
  },
  festival: {
    file: 'festival_config.json'
  }
};

class ConfigManager {
  _getConfigPath(configName) {
    const definition = CONFIG_DEFINITIONS[configName];
    if (!definition) throw new Error(`Unknown config: ${configName}`);
    return path.join(CONFIG_DIR, definition.file);
  }

  async _readConfigFile(configPath) {
    try {
      const fileContent = await fs.readFile(configPath, 'utf8');
      return JSON.parse(fileContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`Config file not found: ${configPath}`);
        return {};
      }
      throw error;
    }
  }

  _readConfigFileSync(configPath) {
    try {
      const fileContent = require('fs').readFileSync(configPath, 'utf8');
      return JSON.parse(fileContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`Config file not found: ${configPath}`);
        return {};
      }
      throw error;
    }
  }

  async getConfig(configName) {
    const definition = CONFIG_DEFINITIONS[configName];
    if (!definition) throw new Error(`Unknown config: ${configName}`);

    const configPath = this._getConfigPath(configName);

    try {
      const config = await this._readConfigFile(configPath);
      return config || {};
    } catch (error) {
      console.error(`Failed to load config ${configName}:`, error.message);
      return {};
    }
  }

  getConfigSync(configName) {
    const definition = CONFIG_DEFINITIONS[configName];
    if (!definition) throw new Error(`Unknown config: ${configName}`);

    const configPath = this._getConfigPath(configName);

    try {
      const config = this._readConfigFileSync(configPath);
      return config || {};
    } catch (error) {
      console.error(`Failed to load config ${configName}:`, error.message);
      return {};
    }
  }

  async saveConfig(configName, configData) {
    const definition = CONFIG_DEFINITIONS[configName];
    if (!definition) throw new Error(`Unknown config: ${configName}`);

    const configPath = this._getConfigPath(configName);

    try {
      const configDir = path.dirname(configPath);
      try {
        await fs.access(configDir);
      } catch {
        await fs.mkdir(configDir, { recursive: true });
      }

      await fs.writeFile(configPath, JSON.stringify(configData, null, 2), 'utf8');

      console.log(`Config saved successfully: ${configName}`);
      return { success: true, message: `配置 ${configName} 保存成功` };
    } catch (error) {
      console.error(`Failed to save config ${configName}:`, error.message);
      throw error;
    }
  }

  getConfigValue(configName, keyPath, defaultValue) {
    const config = this.getConfigSync(configName);
    const keys = keyPath.split('.');
    let value = config;

    for (const key of keys) {
      if (value === undefined || value === null) return defaultValue;
      value = value[key];
    }

    return value !== undefined ? value : defaultValue;
  }

  async getConfigValueAsync(configName, keyPath, defaultValue) {
    const config = await this.getConfig(configName);
    const keys = keyPath.split('.');
    let value = config;

    for (const key of keys) {
      if (value === undefined || value === null) return defaultValue;
      value = value[key];
    }

    return value !== undefined ? value : defaultValue;
  }

  getAvailableConfigs() {
    return Object.keys(CONFIG_DEFINITIONS);
  }

  registerConfig(configName, definition) {
    if (CONFIG_DEFINITIONS[configName]) {
      throw new Error(`Config ${configName} already registered`);
    }

    if (!definition.file) {
      throw new Error('Config definition must include file');
    }

    CONFIG_DEFINITIONS[configName] = {
      file: definition.file
    };
  }
}

const configManager = new ConfigManager();

module.exports = { ConfigManager, configManager };
