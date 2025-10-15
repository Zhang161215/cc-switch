// 测试更新 Droid Provider 功能
const fs = require('fs');
const path = require('path');

// 读取 CC Switch 配置
const ccSwitchConfigPath = path.join(process.env.HOME, '.cc-switch', 'config.json');
console.log('Reading CC Switch config from:', ccSwitchConfigPath);

try {
  const config = JSON.parse(fs.readFileSync(ccSwitchConfigPath, 'utf8'));
  console.log('Current droid providers:', JSON.stringify(config.droid_manager, null, 2));
  
  if (config.droid_manager && config.droid_manager.providers.length > 0) {
    const provider = config.droid_manager.providers[0];
    console.log('\nCurrent provider:', {
      id: provider.id,
      name: provider.name,
      model_display_name: provider.model_display_name
    });
    
    // 测试更新名称
    provider.name = "测试更新 " + new Date().toISOString();
    console.log('\nUpdating provider name to:', provider.name);
    
    // 保存更新
    fs.writeFileSync(ccSwitchConfigPath, JSON.stringify(config, null, 2));
    console.log('Config saved successfully');
    
    // 检查 Factory 配置
    const factoryConfigPath = path.join(process.env.HOME, '.factory', 'config.json');
    const factoryConfig = JSON.parse(fs.readFileSync(factoryConfigPath, 'utf8'));
    console.log('\nFactory custom models:', JSON.stringify(factoryConfig.custom_models, null, 2));
  }
} catch (error) {
  console.error('Error:', error);
}
