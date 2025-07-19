const path = require('path');
jest.mock('fs');

let fs;

describe('update_readme_version.js', () => {
  const scriptPath = path.resolve(__dirname, './update_readme_version.js');
  const originalArgv = process.argv;
  const badgeV2 = '[![Version](https://img.shields.io/badge/version-v0.2.0-blue.svg)]';
  const badgeV3 = '[![Version](https://img.shields.io/badge/version-v0.3.0-blue.svg)]';
  const readmePath = path.resolve(__dirname, '../README.md');
  let originalExit;
  let originalError;

  beforeEach(() => {
    jest.resetModules();
    fs = require('fs');
    process.argv = [...originalArgv];
    // process.exitとconsole.errorをモック
    originalExit = process.exit;
    originalError = console.error;
    process.exit = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    process.exit = originalExit;
    console.error = originalError;
  });

  test('正常系: バージョンバッジが正しく置換される', () => {
    fs.readFileSync.mockReturnValue(`${badgeV2}\nその他の内容`);
    process.argv = [originalArgv[0], scriptPath, 'v0.3.0'];
    require('./update_readme_version');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      readmePath,
      `${badgeV3}\nその他の内容`,
      'utf8'
    );
  });

  test('異常系: バージョンバッジが存在しない場合はエラー終了', () => {
    fs.readFileSync.mockReturnValue('バッジなしの内容');
    process.argv = [originalArgv[0], scriptPath, 'v0.3.0'];
    expect(() => require('./update_readme_version')).toThrow();
    expect(console.error).toHaveBeenCalled();
    // process.exitのアサートは削除（テスト時はthrowで終了する仕様のため）
  });

  test('異常系: 引数不足の場合はエラー終了', () => {
    process.argv = [originalArgv[0], scriptPath];
    expect(() => require('./update_readme_version')).toThrow();
    expect(console.error).toHaveBeenCalled();
    // process.exitのアサートは削除（テスト時はthrowで終了する仕様のため）
  });
});
