// ============================================
// 전역 상태 관리
// - 모든 탭 간 데이터 공유를 위한 중앙 저장소
// ============================================

let appState = {
    service: '',           // 서비스 목적
    platform: '',          // OS/플랫폼
    mood: { soft: 50, static: 50 },  // 무드 슬라이더 값
    keyword: '',           // 선택된 키워드
    primaryColor: '',      // 주조 색상
    generatedResult: null, // AI 생성 결과 (색상 시스템)
    labColors: {           // 유니버설 컬러시스템에서 설정한 색상
        bgColor: '#F5F5F5',
        textColor: '#333333'
    }
};

let knowledgeBase = {};  // knowledge_base.json 데이터
let typingTimeout;       // 타이핑 효과 타이머
let reportData = null;   // AI 리포트 데이터
let currentCodeTab = 'css';  // 현재 선택된 코드 탭

// ============================================
// 앱 초기화
// ============================================

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    try {
        // knowledge_base.json 로드
        const response = await fetch('./knowledge_base.json');
        if (!response.ok) throw new Error('Network response was not ok');
        knowledgeBase = await response.json();
        
        // 각 페이지 초기화
        setupNavigation();
        initializeMainPage();
        initializeLabPage();
        initializeReportPage(); // <-- 이 함수가 수정됨

    } catch (error) {
        console.error('Failed to initialize app:', error);
        updateAIMessage("시스템 초기화 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", true);
    }
}

// ============================================
// 1. 네비게이션 설정
// ============================================

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.main-page, .lab-page, .report-page');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');

            // 리포트 탭은 AI 생성 결과가 있을 때만 활성화
            if (targetId === 'report-page' && !reportData) {
                alert('먼저 AI 디자인 가이드를 생성해주세요.');
                return;
            }

            // 모든 페이지 숨기기
            pages.forEach(page => page.classList.remove('active'));
            navLinks.forEach(nav => nav.classList.remove('active'));

            // 대상 페이지 보이기
            document.getElementById(targetId).classList.add('active');
            link.classList.add('active');
            
            // 리포트 탭으로 이동 시, 리포트 데이터로 렌더링
            if (targetId === 'report-page' && reportData) {
                renderReport(reportData);
            }
        });
    });
}

// ============================================
// 2. 메인 페이지 (가이드 생성) 초기화
// ============================================

function initializeMainPage() {
    // (이전과 동일)
    const serviceInput = document.getElementById('service-purpose');
    const platformSelect = document.getElementById('platform-select');
    const moodSoftSlider = document.getElementById('mood-soft');
    const moodStaticSlider = document.getElementById('mood-static');
    const colorInput = document.getElementById('primary-color');
    const colorPicker = document.getElementById('color-picker');
    const generateBtn = document.getElementById('generate-btn');
    const keywordChipsContainer = document.getElementById('keyword-chips');

    serviceInput.addEventListener('change', (e) => appState.service = e.target.value);
    platformSelect.addEventListener('change', (e) => appState.platform = e.target.value);
    moodSoftSlider.addEventListener('input', (e) => appState.mood.soft = parseInt(e.target.value));
    moodStaticSlider.addEventListener('input', (e) => appState.mood.static = parseInt(e.target.value));
    
    moodSoftSlider.addEventListener('change', updateKeywordChips);
    moodStaticSlider.addEventListener('change', updateKeywordChips);

    colorInput.addEventListener('input', (e) => {
        let hex = e.target.value;
        if (hex.match(/^#[0-9a-fA-F]{6}$/) || hex.match(/^#[0-9a-fA-F]{3}$/)) {
            appState.primaryColor = hex;
            colorPicker.value = hex;
        }
    });

    colorPicker.addEventListener('input', (e) => {
        appState.primaryColor = e.target.value;
        colorInput.value = e.target.value;
    });

    updateKeywordChips();
    generateBtn.addEventListener('click', handleGenerateRequest);
}

// (이전과 동일)
function updateKeywordChips() {
    const keywords = getKeywordsFromMood(appState.mood.soft, appState.mood.static);
    const container = document.getElementById('keyword-chips');
    container.innerHTML = ''; 

    keywords.forEach(keyword => {
        const chip = document.createElement('button');
        chip.className = 'keyword-chip';
        chip.textContent = keyword;
        chip.dataset.keyword = keyword;

        if (keyword === appState.keyword) {
            chip.classList.add('active');
        }

        chip.addEventListener('click', () => {
            container.querySelectorAll('.keyword-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            appState.keyword = keyword;
        });
        container.appendChild(chip);
    });

    if (!keywords.includes(appState.keyword)) {
        appState.keyword = '';
    }
}

// (이전과 동일)
function getKeywordsFromMood(soft, staticMood) {
    const isSoft = soft > 50;
    const isStatic = staticMood > 50;
    
    let description = "";
    if (isSoft && isStatic) description = "Soft + Static"; // group2
    else if (isSoft && !isStatic) description = "Soft + Dynamic"; // group1
    else if (!isSoft && isStatic) description = "Hard + Static"; // group3
    else description = "Hard + Dynamic"; // group4
    
    const groups = Object.values(knowledgeBase.iri_colors || {});
    const foundGroup = groups.find(g => g.description === description);
    
    if (foundGroup) {
        return foundGroup.keywords;
    }
    
    return knowledgeBase.iri_colors?.group1?.keywords || ["귀여운", "경쾌한"];
}

// (이전과 동일)
async function handleGenerateRequest() {
    const generateBtn = document.getElementById('generate-btn');
    const btnText = document.getElementById('btn-text');
    const btnLoader = document.getElementById('btn-loader');

    if (!appState.service || !appState.platform || !appState.keyword) {
        updateAIMessage("서비스 목적, 플랫폼, AI 추천 키워드를 모두 선택해주세요.", true);
        return;
    }

    generateBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'block';
    updateAIMessage("AI가 디자인 가이드를 생성 중입니다... (최대 1분 소요)");

    try {
        const context = {
            service: appState.service,
            platform: appState.platform,
            keyword: appState.keyword,
            primaryColor: appState.primaryColor || null
        };
        
        const response = await fetch('/.netlify/functions/generate-guide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context, knowledgeBase })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }

        const result = await response.json();
        
        reportData = result; 
        appState.generatedResult = result.colorSystem; 

        updateAIMessage("AI 디자인 가이드 생성이 완료되었습니다! 'AI 디자인 리포트' 탭에서 결과를 확인하세요.");
        
        const reportNavLink = document.querySelector('.nav-link[data-target="report-page"]');
        reportNavLink.click();

    } catch (error) {
        console.error('Error generating guide:', error);
        updateAIMessage("죄송합니다. AI 가이드 생성 중 오류가 발생했습니다. 입력값을 확인하고 다시 시도해주세요.", true);
    } finally {
        generateBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
}

// (이전과 동일)
function updateAIMessage(text, isError = false) {
    const messageText = document.getElementById('ai-message-text');
    const cursor = document.querySelector('.typing-cursor');
    const messageBox = document.getElementById('ai-message-box');
    
    messageText.textContent = ''; 
    if (typingTimeout) clearTimeout(typingTimeout); 
    
    if (isError) {
        messageBox.classList.add('error');
    } else {
        messageBox.classList.remove('error');
    }

    let i = 0;
    cursor.style.display = 'inline-block'; 

    function typeWriter() {
        if (i < text.length) {
            messageText.textContent += text.charAt(i);
            i++;
            typingTimeout = setTimeout(typeWriter, 30); 
        } else {
            cursor.style.display = 'none'; 
        }
    }
    typeWriter();
}

// ============================================
// 3. 유니버설 컬러시스템 실험실 초기화
// ============================================

function initializeLabPage() {
    // (이전과 동일)
    const bgColorText = document.getElementById('lab-bg-color-text');
    const bgColorPicker = document.getElementById('lab-bg-color-picker');
    const textColorText = document.getElementById('lab-text-color-text');
    const textColorPicker = document.getElementById('lab-text-color-picker');
    const swapBtn = document.getElementById('swap-colors-btn');
    const resetBtn = document.getElementById('reset-colors-btn');

    const updateColors = (source) => {
        if (source === 'text') {
            textColorPicker.value = textColorText.value;
        } else if (source === 'textPicker') {
            textColorText.value = textColorPicker.value;
        } else if (source === 'bg') {
            bgColorPicker.value = bgColorText.value;
        } else if (source === 'bgPicker') {
            bgColorText.value = bgColorPicker.value;
        }

        appState.labColors.bgColor = bgColorText.value;
        appState.labColors.textColor = textColorText.value;
        updateLabPreview();
    };

    bgColorText.addEventListener('change', () => updateColors('bg'));
    bgColorPicker.addEventListener('input', () => updateColors('bgPicker'));
    textColorText.addEventListener('change', () => updateColors('text'));
    textColorPicker.addEventListener('input', () => updateColors('textPicker'));

    swapBtn.addEventListener('click', () => {
        const tempBg = bgColorText.value;
        bgColorText.value = textColorText.value;
        textColorText.value = tempBg;
        bgColorPicker.value = bgColorText.value;
        textColorPicker.value = textColorText.value;
        updateColors('swap');
    });

    resetBtn.addEventListener('click', () => {
        const defaultBg = '#F5F5F5';
        const defaultText = '#333333';
        bgColorText.value = defaultBg;
        bgColorPicker.value = defaultBg;
        textColorText.value = defaultText;
        textColorPicker.value = defaultText;
        updateColors('reset');
    });

    const fontPairingList = document.getElementById('font-pairing-list');
    const pairings = knowledgeBase.font_pairing_recommendations || [];
    fontPairingList.innerHTML = pairings.map(p => `<li><strong>${p.combination}:</strong> ${p.reason}</li>`).join('');

    updateLabPreview();
}

// (이전과 동일)
function updateLabPreview() {
    const { bgColor, textColor } = appState.labColors;
    
    const preview = document.getElementById('simulator-preview');
    const headline = document.getElementById('preview-headline');
    const bodyText = document.getElementById('preview-body-text');
    const button = document.getElementById('preview-button');

    preview.style.backgroundColor = bgColor;
    headline.style.color = textColor;
    bodyText.style.color = textColor;
    
    const primaryMain = appState.generatedResult?.primary.main || textColor;
    
    button.style.backgroundColor = primaryMain;
    button.style.color = getContrastYIQ(primaryMain) ? '#000000' : '#FFFFFF'; 
    
    const contrast = calculateContrast(bgColor, textColor);
    document.getElementById('contrast-ratio-value').textContent = `${contrast.toFixed(2)}:1`;

    updateWCAGStatus('wcag-aa-normal', contrast >= 4.5);
    updateWCAGStatus('wcag-aa-large', contrast >= 3);
    updateWCAGStatus('wcag-aaa-normal', contrast >= 7);
    updateWCAGStatus('wcag-aaa-large', contrast >= 4.5);
}

// (이전과 동일)
function updateWCAGStatus(elementId, passed) {
    const el = document.getElementById(elementId);
    const statusEl = el.querySelector('span:last-child');
    if (passed) {
        statusEl.textContent = 'PASS';
        statusEl.className = 'pass';
    } else {
        statusEl.textContent = 'FAIL';
        statusEl.className = 'fail';
    }
}


// ============================================
// 4. AI 리포트 페이지 초기화
// ============================================

function initializeReportPage() {
    // [추가] 다운로드 버튼 이벤트 리스너 연결
    // DOM 로드 시점에 버튼이 없을 수 있으므로, 
    // 나중에 탭이 활성화될 때를 대비해 document 레벨에서 이벤트를 위임하는 것이 더 안전하지만,
    // 우선은 DOMContentLoaded에서 찾는 시도를 합니다.
    // (네비게이션 로직에서 탭을 클릭해 활성화할 때 버튼이 이미 존재해야 합니다)
    const downloadBtn = document.getElementById('download-report-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadReportAsImage);
    } else {
        // 탭이 나중에 활성화될 때 버튼이 생성될 수 있으므로, 
        // 탭 네비게이션 로직에서 이 이벤트를 다시 확인하는 것이 좋습니다.
        // 하지만 지금 구조에서는 initializeApp 시점에 버튼이 HTML에 존재하므로
        // 찾을 수 있어야 합니다. 
        console.warn('Download button (id="download-report-btn") not found during init.');
    }

    // (기존 코드) - 코드 내보내기 탭 로직
    const exportTabs = document.querySelectorAll('.export-tab');
    exportTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            exportTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCodeTab = tab.dataset.tab;
            updateCodeOutput();
        });
    });

    // (기존 코드) - 코드 복사 버튼 로직
    const copyBtn = document.getElementById('copy-code-btn');
    copyBtn.addEventListener('click', () => {
        const code = document.getElementById('code-output').textContent;
        navigator.clipboard.writeText(code).then(() => {
            copyBtn.textContent = '✅ Copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.textContent = '📋 Copy to Clipboard';
                copyBtn.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy code:', err);
        });
    });
}

// [추가] PNG 다운로드 기능 함수
/**
 * AI 리포트 영역을 이미지로 캡처하여 다운로드하는 함수
 */
async function downloadReportAsImage() {
    // 1. 캡처할 대상: 'report-content' (섹션들을 감싼 래퍼)
    const reportContentElement = document.getElementById('report-content');
    // 캡처할 대상 2: 'report-header' (제목 + 버튼)
    const reportHeaderElement = document.querySelector('.report-header'); 
    
    const downloadBtn = document.getElementById('download-report-btn');

    if (!reportContentElement || !reportHeaderElement) {
        console.error('Report content or header element not found!');
        alert('리포트 콘텐츠 영역을 찾을 수 없습니다.');
        return;
    }

    // 캡처 중임을 알리기 위해 버튼 상태 변경
    const originalBtnText = downloadBtn.textContent;
    downloadBtn.textContent = '이미지 생성 중...';
    downloadBtn.disabled = true;

    try {
        // 캡처 대상이 2개(헤더, 콘텐츠)이므로 임시 래퍼를 만들어 캡처합니다.
        // 이것이 흰 화면의 원인일 수 있습니다.
        // >> 수정: 캡처 대상을 'report-page' (부모)로 변경합니다.
        
        const captureTarget = document.getElementById('report-page');

        // 캡처하는 동안 버튼을 잠시 숨겨서 이미지에 안 나오게 함
        downloadBtn.style.visibility = 'hidden';

        const canvas = await html2canvas(captureTarget, {
            scale: 2, // 2배 해상도로 캡처
            useCORS: true,
            // 캡처 대상의 실제 배경색을 지정 (body의 배경색 등)
            backgroundColor: '#f8f9fa' 
        });

        // 캡처가 끝나면 버튼을 다시 보이게 함
        downloadBtn.style.visibility = 'visible';

        // PNG 이미지 데이터 URL 생성
        const dataUrl = canvas.toDataURL('image/png');

        // 임시 링크로 다운로드
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'ai-design-report.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error('리포트 이미지 생성 중 오류 발생:', error);
        alert('리포트 이미지 생성 중 오류가 발생했습니다.');
    } finally {
        // 버튼 상태 원상복구
        downloadBtn.style.visibility = 'visible';
        downloadBtn.textContent = originalBtnText;
        downloadBtn.disabled = false;
    }
}


// (이전과 동일)
function renderReport(data) {
    if (!data) return;

    // 1. 컬러 팔레트 렌더링
    const paletteGrid = document.getElementById('color-palette-grid');
    paletteGrid.innerHTML = ''; 
    
    const renderColorGroup = (group, name) => {
        if (!group) return; // [수정] group이 없는 경우 방어
        Object.entries(group).forEach(([key, value]) => {
            const card = document.createElement('div');
            card.className = 'color-card';
            
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = value;
            
            const info = document.createElement('div');
            info.className = 'color-info';
            info.innerHTML = `<strong>${name} (${key})</strong><span>${value}</span>`;
            
            card.appendChild(swatch);
            card.appendChild(info);
            paletteGrid.appendChild(card);
        });
    };
    
    if (data.colorSystem) {
        renderColorGroup(data.colorSystem.primary, 'Primary');
        renderColorGroup(data.colorSystem.secondary, 'Secondary');
    }
    document.getElementById('color-reasoning').textContent = data.reasoning?.color || '-';

    // 2. 타이포그래피 렌더링
    const typographySpecs = document.getElementById('typography-specs');
    typographySpecs.innerHTML = ''; 
    
    if (data.typography) {
        Object.entries(data.typography).forEach(([key, value]) => {
            const item = document.createElement('div');
            item.className = 'spec-item';
            item.innerHTML = `<span class="spec-label">${key}</span><span class="spec-value">${value}</span>`;
            typographySpecs.appendChild(item);
        });
    }
    document.getElementById('typography-reasoning').textContent = data.reasoning?.typography || '-';
    
    // 3. 유니버설 디자인 가이드 렌더링
    const universalGuide = document.getElementById('universal-guide');
    universalGuide.innerHTML = ''; 
    
    if (data.accessibility) {
        Object.entries(data.accessibility).forEach(([key, value]) => {
            const item = document.createElement('div');
            item.className = 'spec-item';
            item.innerHTML = `<span class="spec-label">${key}</span><span class="spec-value">${value}</span>`;
            universalGuide.appendChild(item);
        });
    }
    document.getElementById('universal-reasoning').textContent = data.reasoning?.accessibility || '-';

    // 4. 컴포넌트 미리보기 렌더링
    renderComponentShowcase(data.colorSystem);

    // 5. 코드 내보내기 (초기 탭)
    updateCodeOutput();
}

// (이전과 동일)
function renderComponentShowcase(colorSystem) {
    if (!colorSystem) return;

    const showcase = document.getElementById('component-showcase');
    const p = colorSystem.primary.main;
    const s = colorSystem.secondary.main;
    const textOnP = getContrastYIQ(p) ? '#000' : '#fff';

    showcase.innerHTML = `
        <div class="component-example">
            <h4>Button</h4>
            <button style="background-color: ${p}; color: ${textOnP};">Primary Button</button>
            <button style="background-color: ${s}; color: ${getContrastYIQ(s) ? '#000' : '#fff'};">Secondary</button>
        </div>
        <div class="component-example">
            <h4>Alert</h4>
            <div class="alert" style="background-color: ${colorSystem.primary.light}; border-left-color: ${p};">
                <strong style="color: ${colorSystem.primary.dark};">Info:</strong> This is an info message.
            </div>
        </div>
        <div class="component-example">
            <h4>Card</h4>
            <div class="card-example">
                <h5 style="color: ${p};">Card Title</h5>
                <p>This is example text inside a card component.</p>
            </div>
        </div>
    `;
}

// (이전과 동일)
function updateCodeOutput() {
    const outputEl = document.getElementById('code-output');
    if (!reportData || !reportData.colorSystem) {
        outputEl.textContent = '/* AI 가이드를 먼저 생성해주세요. */';
        return;
    }

    const { primary, secondary } = reportData.colorSystem;

    switch (currentCodeTab) {
        case 'css':
            outputEl.textContent = `
:root {
  --color-primary: ${primary.main};
  --color-primary-light: ${primary.light};
  --color-primary-dark: ${primary.dark};
  
  --color-secondary: ${secondary.main};
  --color-secondary-light: ${secondary.light};
  --color-secondary-dark: ${secondary.dark};
  
  /* (Grayscale 등 추가) */
}
            `;
            break;
        case 'scss':
            outputEl.textContent = `
$color-primary: ${primary.main};
$color-primary-light: ${primary.light};
$color-primary-dark: ${primary.dark};

$color-secondary: ${secondary.main};
$color-secondary-light: ${secondary.light};
$color-secondary-dark: ${secondary.dark};

/* (Grayscale 등 추가) */
            `;
            break;
        case 'tailwind':
            outputEl.textContent = `
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          light: '${primary.light}',
          DEFAULT: '${primary.main}',
          dark: '${primary.dark}',
        },
        secondary: {
          light: '${secondary.light}',
          DEFAULT: '${secondary.main}',
          dark: '${secondary.dark}',
        },
        // (Grayscale 등 추가)
      },
    },
  },
  plugins: [],
}
            `;
            break;
    }
}


// ============================================
// 유틸리티 함수
// ============================================

// (이전과 동일)
function hexToRgb(hex) {
    if (!hex) return null; // [수정] 방어 코드
    let c = hex.substring(1).split('');
    if (c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return {
        r: (c >> 16) & 255,
        g: (c >> 8) & 255,
        b: c & 255
    };
}

// (이전과 동일)
function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

// (이전과 동일)
function calculateContrast(hex1, hex2) {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    
    if (!rgb1 || !rgb2) return 1;

    const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
    
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
}

// (이전과 동일)
function getContrastYIQ(hex){
    const rgb = hexToRgb(hex);
    if (!rgb) return false;
    const yiq = ((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000;
    return (yiq >= 128); 
}

// (이전과 동일) - (참고: 이 함수는 원본에 버그가 있을 수 있으나 수정하지 않음)
function lightenDarkenColor(hex, amt) {
    let usePound = false;
    if (hex[0] == "#") {
        hex = hex.slice(1);
        usePound = true;
    }
    let num = parseInt(hex, 16);
    let r = (num >> 16) + amt;
    if (r > 255) r = 255;
    else if (r < 0) r = 0;
    let b = ((num >> 8) & 0x00FF) + amt;
    if (b > 255) b = 255;
    else if (b < 0) b = 0;
    let g = (num & 0x0000FF) + amt;
    if (g > 255) g = 255;
    else if (g < 0) g = 0;
    return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}

// (이전과 동일)
function getComplementaryColor(hex){
    const rgb = hexToRgb(hex);
    if (!rgb) return '#000000';
    let r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max == min) { 
        h = s = 0; 
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    
    h = (h + 0.5) % 1.0; 
    
    let r_comp, g_comp, b_comp;
    if(s == 0){
        r_comp = g_comp = b_comp = l; 
    }else{
        const hue2rgb = (p, q, t) => {
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        let p = 2 * l - q;
        r_comp = hue2rgb(p, q, h + 1/3);
        g_comp = hue2rgb(p, q, h);
        b_comp = hue2rgb(p, q, h - 1/3);
    }
    
    const toHex = (c) => {
        let hex = Math.round(c * 255).toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    };
    
    return `#${toHex(r_comp)}${toHex(g_comp)}${toHex(b_comp)}`;
}