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
        initializeReportPage();

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
    // 요소 캐싱
    const serviceInput = document.getElementById('service-purpose');
    const platformSelect = document.getElementById('platform-select');
    const moodSoftSlider = document.getElementById('mood-soft');
    const moodStaticSlider = document.getElementById('mood-static');
    const colorInput = document.getElementById('primary-color');
    const colorPicker = document.getElementById('color-picker');
    const generateBtn = document.getElementById('generate-btn');
    const keywordChipsContainer = document.getElementById('keyword-chips');

    // 이벤트 리스너 바인딩
    serviceInput.addEventListener('change', (e) => appState.service = e.target.value);
    platformSelect.addEventListener('change', (e) => appState.platform = e.target.value);
    moodSoftSlider.addEventListener('input', (e) => appState.mood.soft = parseInt(e.target.value));
    moodStaticSlider.addEventListener('input', (e) => appState.mood.static = parseInt(e.target.value));
    
    // 무드 슬라이더 변경 시 키워드 다시 필터링
    moodSoftSlider.addEventListener('change', updateKeywordChips);
    moodStaticSlider.addEventListener('change', updateKeywordChips);

    // HEX 색상 입력
    colorInput.addEventListener('input', (e) => {
        let hex = e.target.value;
        if (hex.match(/^#[0-9a-fA-F]{6}$/) || hex.match(/^#[0-9a-fA-F]{3}$/)) {
            appState.primaryColor = hex;
            colorPicker.value = hex;
        }
    });

    // 컬러 피커 입력
    colorPicker.addEventListener('input', (e) => {
        appState.primaryColor = e.target.value;
        colorInput.value = e.target.value;
    });

    // 키워드 칩 생성
    updateKeywordChips();

    // 생성 버튼 클릭
    generateBtn.addEventListener('click', handleGenerateRequest);
}

// 키워드 칩 업데이트 및 선택 로직
function updateKeywordChips() {
    const keywords = getKeywordsFromMood(appState.mood.soft, appState.mood.static);
    const container = document.getElementById('keyword-chips');
    container.innerHTML = ''; // 기존 칩 제거

    keywords.forEach(keyword => {
        const chip = document.createElement('button');
        chip.className = 'keyword-chip';
        chip.textContent = keyword;
        chip.dataset.keyword = keyword;

        // 현재 선택된 키워드 표시
        if (keyword === appState.keyword) {
            chip.classList.add('active');
        }

        chip.addEventListener('click', () => {
            // 모든 칩 비활성화
            container.querySelectorAll('.keyword-chip').forEach(c => c.classList.remove('active'));
            // 클릭된 칩 활성화
            chip.classList.add('active');
            appState.keyword = keyword;
        });
        container.appendChild(chip);
    });

    // 만약 기존에 선택한 키워드가 새 목록에 없다면 선택 해제
    if (!keywords.includes(appState.keyword)) {
        appState.keyword = '';
    }
}

// 무드 값에 따라 키워드 그룹 반환 (임시 로직)
function getKeywordsFromMood(soft, staticMood) {
    // knowledgeBase의 iri_colors를 기반으로 동적 매칭
    // 예시: Soft (soft > 50), Hard (soft <= 50)
    // 예시: Static (staticMood > 50), Dynamic (staticMood <= 50)
    
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
    
    // 기본값 (group1)
    return knowledgeBase.iri_colors?.group1?.keywords || ["귀여운", "경쾌한"];
}


// AI 가이드 생성 요청 처리
async function handleGenerateRequest() {
    const generateBtn = document.getElementById('generate-btn');
    const btnText = document.getElementById('btn-text');
    const btnLoader = document.getElementById('btn-loader');

    // 1. 유효성 검사
    if (!appState.service || !appState.platform || !appState.keyword) {
        updateAIMessage("서비스 목적, 플랫폼, AI 추천 키워드를 모두 선택해주세요.", true);
        return;
    }

    // 2. 로딩 상태 시작
    generateBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'block';
    updateAIMessage("AI가 디자인 가이드를 생성 중입니다... (최대 1분 소요)");

    try {
        // 3. Netlify Function (generate-guide.js) 호출
        const context = {
            service: appState.service,
            platform: appState.platform,
            keyword: appState.keyword,
            primaryColor: appState.primaryColor || null // 빈 문자열 대신 null
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
        
        // 4. 결과 처리
        reportData = result; // AI 리포트 탭을 위한 데이터 저장
        appState.generatedResult = result.colorSystem; // 유니버설 랩을 위한 데이터 저장

        // 5. AI 메시지 업데이트 (성공)
        updateAIMessage("AI 디자인 가이드 생성이 완료되었습니다! 'AI 디자인 리포트' 탭에서 결과를 확인하세요.");
        
        // 리포트 탭 활성화 및 자동 이동
        const reportNavLink = document.querySelector('.nav-link[data-target="report-page"]');
        reportNavLink.click();

    } catch (error) {
        console.error('Error generating guide:', error);
        updateAIMessage("죄송합니다. AI 가이드 생성 중 오류가 발생했습니다. 입력값을 확인하고 다시 시도해주세요.", true);
    } finally {
        // 6. 로딩 상태 종료
        generateBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
}

// AI 메시지 박스 업데이트 (타이핑 효과 포함)
function updateAIMessage(text, isError = false) {
    const messageText = document.getElementById('ai-message-text');
    const cursor = document.querySelector('.typing-cursor');
    const messageBox = document.getElementById('ai-message-box');
    
    messageText.textContent = ''; // 기존 메시지 삭제
    if (typingTimeout) clearTimeout(typingTimeout); // 기존 타이핑 중지
    
    if (isError) {
        messageBox.classList.add('error');
    } else {
        messageBox.classList.remove('error');
    }

    let i = 0;
    cursor.style.display = 'inline-block'; // 커서 보이기

    function typeWriter() {
        if (i < text.length) {
            messageText.textContent += text.charAt(i);
            i++;
            typingTimeout = setTimeout(typeWriter, 30); // 타이핑 속도
        } else {
            cursor.style.display = 'none'; // 타이핑 완료 후 커서 숨김
        }
    }
    typeWriter();
}

// ============================================
// 3. 유니버설 컬러시스템 실험실 초기화
// ============================================

function initializeLabPage() {
    const bgColorText = document.getElementById('lab-bg-color-text');
    const bgColorPicker = document.getElementById('lab-bg-color-picker');
    const textColorText = document.getElementById('lab-text-color-text');
    const textColorPicker = document.getElementById('lab-text-color-picker');
    const swapBtn = document.getElementById('swap-colors-btn');
    const resetBtn = document.getElementById('reset-colors-btn');

    const updateColors = (source) => {
        let bg, text;
        
        if (source === 'text') {
            text = textColorText.value;
            textColorPicker.value = text;
        } else if (source === 'textPicker') {
            text = textColorPicker.value;
            textColorText.value = text;
        } else if (source === 'bg') {
            bg = bgColorText.value;
            bgColorPicker.value = bg;
        } else if (source === 'bgPicker') {
            bg = bgColorPicker.value;
            bgColorText.value = bg;
        } else { // 'swap' or 'reset'
            bg = bgColorText.value;
            text = textColorText.value;
        }

        appState.labColors.bgColor = bg;
        appState.labColors.textColor = text;

        // 미리보기 업데이트
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

    // 폰트 페어링 가이드 채우기
    const fontPairingList = document.getElementById('font-pairing-list');
    const pairings = knowledgeBase.font_pairing_recommendations || [];
    fontPairingList.innerHTML = pairings.map(p => `<li><strong>${p.combination}:</strong> ${p.reason}</li>`).join('');

    // 초기 미리보기 실행
    updateLabPreview();
}

// 유니버설 랩 미리보기 및 접근성 계산 업데이트
function updateLabPreview() {
    const { bgColor, textColor } = appState.labColors;
    
    const preview = document.getElementById('simulator-preview');
    const headline = document.getElementById('preview-headline');
    const bodyText = document.getElementById('preview-body-text');
    const button = document.getElementById('preview-button');

    // 미리보기 색상 적용
    preview.style.backgroundColor = bgColor;
    headline.style.color = textColor;
    bodyText.style.color = textColor;
    
    // 버튼 스타일 (임시: 주조색 또는 반전)
    // AI 생성 결과가 있으면 주조색 사용, 없으면 텍스트색 사용
    const primaryMain = appState.generatedResult?.primary.main || textColor;
    const primaryLight = appState.generatedResult?.primary.light || bgColor;
    
    button.style.backgroundColor = primaryMain;
    button.style.color = getContrastYIQ(primaryMain) ? '#000000' : '#FFFFFF'; // 버튼 텍스트 자동 대비
    
    // 접근성 계산
    const contrast = calculateContrast(bgColor, textColor);
    document.getElementById('contrast-ratio-value').textContent = `${contrast.toFixed(2)}:1`;

    // WCAG 상태 업데이트
    updateWCAGStatus('wcag-aa-normal', contrast >= 4.5);
    updateWCAGStatus('wcag-aa-large', contrast >= 3);
    updateWCAGStatus('wcag-aaa-normal', contrast >= 7);
    updateWCAGStatus('wcag-aaa-large', contrast >= 4.5);
}

// WCAG 상태(Pass/Fail) UI 업데이트
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
    // (참고: 이 원본 버전에는 다운로드 버튼 로직이 없습니다)

    // 코드 내보내기 탭 로직
    const exportTabs = document.querySelectorAll('.export-tab');
    exportTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            exportTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCodeTab = tab.dataset.tab;
            updateCodeOutput();
        });
    });

    // 코드 복사 버튼 로직
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

// AI 리포트 페이지 렌더링
function renderReport(data) {
    if (!data) return;

    // 1. 컬러 팔레트 렌더링
    const paletteGrid = document.getElementById('color-palette-grid');
    paletteGrid.innerHTML = ''; // 초기화
    
    // Primary, Secondary, Grayscale 등을 순회하며 렌더링
    const renderColorGroup = (group, name) => {
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
        // 'grayscale' 등 다른 속성이 있다면 추가
    }
    document.getElementById('color-reasoning').textContent = data.reasoning?.color || '-';

    // 2. 타이포그래피 렌더링
    const typographySpecs = document.getElementById('typography-specs');
    typographySpecs.innerHTML = ''; // 초기화
    
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
    universalGuide.innerHTML = ''; // 초기화
    
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

// 컴포넌트 미리보기 UI 렌더링
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

// 코드 내보내기 탭 콘텐츠 업데이트
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

// 16진수 색상을 RGB 객체로 변환
function hexToRgb(hex) {
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

// RGB 값을 이용해 명도(Luminance) 계산
function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

// 두 16진수 색상 간의 명도 대비 계산
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

// 배경색에 따라 적절한 텍스트 색상(검정/흰색) 반환
function getContrastYIQ(hex){
    const rgb = hexToRgb(hex);
    if (!rgb) return false;
    const yiq = ((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000;
    return (yiq >= 128); // 128 이상이면 밝은색 (검정 텍스트)
}

// 색상 밝게/어둡게 (Shade/Tint)
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

// (참고: 다른 유틸리티 함수들...)
// 보색 계산
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
    
    h = (h + 0.5) % 1.0; // 색상(hue) 180도 회전
    
    let r_comp, g_comp, b_comp;
    if(s == 0){
        r_comp = g_comp = b_comp = l; // 무채색
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