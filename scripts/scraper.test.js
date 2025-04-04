import puppeteer from 'puppeteer';
import { jest } from '@jest/globals';

const fsMock = {
    writeFileSync: jest.fn()
};

// モックを設定
jest.unstable_mockModule('fs', () => ({
    default: fsMock
}));

// モックが設定された後にスクリプトをインポート
const { logErrorDetails, isLoggedIn, login, waitForPostLoginElements, getRemainingData } = await import('./scraper.js');

describe('scraper.js', () => {
    let browser;
    let page;
    
    beforeAll(async () => {
        browser = await puppeteer.launch({ 
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: "new"
        });
        page = await browser.newPage();
    });
    
    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });
    
    describe('logErrorDetails', () => {
        it('should write error details to a file', async () => {
            const mockPage = { url: () => 'https://example.com' };
            const errorMessage = 'Test error message';
            await logErrorDetails(mockPage, errorMessage);
            expect(fsMock.writeFileSync).toHaveBeenCalledWith(
                'error_details.json',
                expect.any(String)
            );
        });
    });

    describe('isLoggedIn', () => {
        it('should return true if the service details button is present', async () => {
            await page.setContent(`
                <div id="ClientAreaHomePagePanels-Active_Products_Services-0">
                    <div>
                        <div class="list-group-item-actions">
                            <button>サービスの詳細</button>
                        </div>
                    </div>
                </div>
            `);
            const result = await isLoggedIn(page);
            expect(result).toBe(true);
        });

        it('should return false if the service details button is not present', async () => {
            await page.setContent('<div></div>');
            const result = await isLoggedIn(page);
            expect(result).toBe(false);
        });
    });

    describe('login', () => {
        it('should throw an error if email or password is missing', async () => {
            await expect(login(page, null, 'password')).rejects.toThrow('環境変数 UCSS_EMAIL または UCSS_PASSWORD が設定されていません');
            await expect(login(page, 'email', null)).rejects.toThrow('環境変数 UCSS_EMAIL または UCSS_PASSWORD が設定されていません');
        });

        it('should log in successfully with valid credentials', async () => {
            await page.setContent(`
                <input id="inputEmail" />
                <input id="inputPassword" />
                <button id="login"></button>
                <div id="ClientAreaHomePagePanels-Active_Products_Services-0">
                    <div>
                        <div class="list-group-item-actions">
                            <button>サービスの詳細</button>
                        </div>
                    </div>
                </div>
            `);
            const mockGoto = jest.spyOn(page, 'goto').mockResolvedValue();
            const mockType = jest.spyOn(page, 'type').mockResolvedValue();
            const mockClick = jest.spyOn(page, 'click').mockResolvedValue();
            const mockWaitForNavigation = jest.spyOn(page, 'waitForNavigation').mockResolvedValue();
            await login(page, 'test@example.com', 'password');
            expect(mockGoto).toHaveBeenCalledWith(expect.stringContaining('login'));
            expect(mockType).toHaveBeenCalledWith('#inputEmail', 'test@example.com');
            expect(mockType).toHaveBeenCalledWith('#inputPassword', 'password');
            expect(mockClick).toHaveBeenCalledWith('#login');
            expect(mockWaitForNavigation).toHaveBeenCalled();
        });
    });

    describe('waitForPostLoginElements', () => {
        it('should wait for the service details button to appear', async () => {
            await page.setContent(`
                <div id="ClientAreaHomePagePanels-Active_Products_Services-0">
                    <div>
                        <div class="list-group-item-actions">
                            <button>サービスの詳細</button>
                        </div>
                    </div>
                </div>
            `);
            await expect(waitForPostLoginElements(page)).resolves.not.toThrow();
        });

        it('should throw an error if the service details button is not found', async () => {
            await page.setContent('<div></div>');
            await expect(waitForPostLoginElements(page)).rejects.toThrow('「サービスの詳細」ページへのリンクが見つかりません');
        });
    });

    describe('getRemainingData', () => {
        it('should extract and return the remaining data', async () => {
            await page.setContent(`
                <div id="ClientAreaHomePagePanels-Active_Products_Services-0">
                    <div>
                        <div class="list-group-item-actions">
                            <button>サービスの詳細</button>
                        </div>
                    </div>
                </div>
                <div id="traffic-header">
                    <p class="free-traffic">
                        <span class="traffic-number">123 GB</span>
                    </p>
                </div>
            `);
            const mockClick = jest.spyOn(page, 'click').mockResolvedValue();
            const remainingData = await getRemainingData(page);
            expect(mockClick).toHaveBeenCalledWith('#ClientAreaHomePagePanels-Active_Products_Services-0 > div > div.list-group-item-actions > button');
            expect(remainingData).toBe('123 GB');
        });

        it('should throw an error if the remaining data element is not found', async () => {
            await page.setContent('<div></div>');
            await expect(getRemainingData(page)).rejects.toThrow('残りデータ通信量の要素が見つかりません');
        });
    });
});