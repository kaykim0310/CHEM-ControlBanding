import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type, X-Application-Name',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { casNumbers } = await req.json()
    
    if (!casNumbers || !Array.isArray(casNumbers)) {
      throw new Error('CAS 번호 배열이 필요합니다.')
    }

    console.log('KOSHA 크롤링 시작 (디버깅 모드):', casNumbers)
    
    const results = []
    
    for (const casNumber of casNumbers) {
      if (!casNumber || casNumber.trim() === '') {
        results.push({
          casNumber: casNumber,
          success: false,
          error: 'CAS 번호가 비어있습니다.'
        })
        continue
      }
      
      try {
        console.log(`${casNumber} 크롤링 시작...`)
        
        // 단계별 크롤링 시도
        const crawlResult = await attemptKoshaCrawl(casNumber)
        
        results.push({
          casNumber: casNumber,
          success: crawlResult.success,
          data: crawlResult.data,
          error: crawlResult.error,
          debug: crawlResult.debug,
          source: 'kosha_crawl_attempt'
        })
        
        console.log(`${casNumber} 결과:`, crawlResult)
        
        // 요청 간격 조절
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.error(`${casNumber} 오류:`, error)
        results.push({
          casNumber: casNumber,
          success: false,
          error: error.message,
          debug: { errorType: 'exception', errorMessage: error.message }
        })
      }
    }
    
    console.log('크롤링 완료. 총 결과:', results.length)
    console.log('성공한 결과:', results.filter(r => r.success).length)
    
    return new Response(
      JSON.stringify({ success: true, results }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
    
  } catch (error) {
    console.error('크롤링 함수 전체 오류:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        debug: { errorType: 'function_error', errorMessage: error.message }
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 500
      }
    )
  }
})

// KOSHA 크롤링 시도 함수
async function attemptKoshaCrawl(casNumber: string) {
  const debug = {
    steps: [],
    errors: [],
    htmlLengths: {},
    urls: {}
  }
  
  try {
    debug.steps.push('크롤링 시작')
    
    // 방법 1: 간단한 GET 요청으로 시도
    const simpleUrl = `https://msds.kosha.or.kr/MSDSInfo/kcic/msdssearchAll.do?searchKeyword=${encodeURIComponent(casNumber)}`
    debug.urls.simple = simpleUrl
    debug.steps.push('간단한 GET 요청 시도')
    
    try {
      const response = await fetch(simpleUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      })
      
      debug.steps.push(`GET 응답: ${response.status}`)
      
      if (response.ok) {
        const html = await response.text()
        debug.htmlLengths.simple = html.length
        debug.steps.push(`HTML 길이: ${html.length}`)
        
        // HTML에서 기본적인 데이터 추출 시도
        const extractedData = extractBasicData(html, casNumber, debug)
        
        if (extractedData.hasData) {
          debug.steps.push('데이터 추출 성공')
          return {
            success: true,
            data: extractedData.data,
            error: null,
            debug: debug
          }
        } else {
          debug.steps.push('데이터 추출 실패 - 기본값 사용')
        }
      } else {
        debug.errors.push(`GET 요청 실패: ${response.status}`)
      }
    } catch (error) {
      debug.errors.push(`GET 요청 오류: ${error.message}`)
    }
    
    // 방법 2: 알려진 화학물질에 대한 기본 데이터 제공
    debug.steps.push('기본 데이터 확인')
    const basicData = getBasicKnownData(casNumber)
    
    if (basicData) {
      debug.steps.push('알려진 화학물질 데이터 사용')
      return {
        success: true,
        data: basicData,
        error: null,
        debug: debug
      }
    }
    
    // 방법 3: 기본값 반환
    debug.steps.push('기본값 반환')
    return {
      success: false,
      data: {
        physicalState: 'mg', // 기본값
        twaPpm: '',
        twaMg: '',
        hCode: '',
        boilingPoint: ''
      },
      error: 'KOSHA에서 해당 CAS 번호를 찾을 수 없습니다.',
      debug: debug
    }
    
  } catch (error) {
    debug.errors.push(`전체 오류: ${error.message}`)
    return {
      success: false,
      data: null,
      error: error.message,
      debug: debug
    }
  }
}

// 기본적인 데이터 추출 함수
function extractBasicData(html: string, casNumber: string, debug: any) {
  const data = {
    physicalState: '',
    twaPpm: '',
    twaMg: '',
    hCode: '',
    boilingPoint: ''
  }
  
  let hasData = false
  
  try {
    debug.steps.push('HTML 정제 시작')
    
    // HTML 정제
    const cleanText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    debug.steps.push(`정제된 텍스트 길이: ${cleanText.length}`)
    
    // 간단한 패턴으로 데이터 찾기
    
    // 성상 찾기
    const statePatterns = ['액체', '기체', '고체']
    for (const state of statePatterns) {
      if (cleanText.includes(state)) {
        if (state === '액체' || state === '기체') {
          data.physicalState = 'ppm'
        } else {
          data.physicalState = 'mg'
        }
        hasData = true
        debug.steps.push(`성상 발견: ${state} -> ${data.physicalState}`)
        break
      }
    }
    
    // TWA 값 찾기
    const twaMatch = cleanText.match(/TWA[:\s]*([0-9.]+)\s*(ppm|mg)/i)
    if (twaMatch) {
      const value = twaMatch[1]
      const unit = twaMatch[2].toLowerCase()
      
      if (unit === 'ppm') {
        data.twaPpm = value
      } else {
        data.twaMg = value
      }
      hasData = true
      debug.steps.push(`TWA 발견: ${value} ${unit}`)
    }
    
    // H-CODE 찾기
    const hCodes = [...cleanText.matchAll(/H[0-9]{3}/g)]
    if (hCodes.length > 0) {
      const uniqueHCodes = [...new Set(hCodes.map(m => m[0]))]
      data.hCode = uniqueHCodes.join(', ')
      hasData = true
      debug.steps.push(`H-CODE 발견: ${data.hCode}`)
    }
    
    // 끓는점 찾기
    const boilingMatch = cleanText.match(/([-0-9.~\-]+)\s*℃/i)
    if (boilingMatch) {
      data.boilingPoint = boilingMatch[1]
      hasData = true
      debug.steps.push(`끓는점 발견: ${data.boilingPoint}`)
    }
    
    debug.steps.push(`데이터 추출 완료. 데이터 있음: ${hasData}`)
    
  } catch (error) {
    debug.errors.push(`데이터 추출 오류: ${error.message}`)
  }
  
  return { data, hasData }
}

// 알려진 화학물질 기본 데이터
function getBasicKnownData(casNumber: string) {
  const knownData = {
    '64-17-5': { physicalState: 'ppm', twaPpm: '1000', twaMg: '', hCode: 'H225, H319, H336', boilingPoint: '78.37' },
    '67-56-1': { physicalState: 'ppm', twaPpm: '200', twaMg: '', hCode: 'H225, H301, H311, H331, H370', boilingPoint: '64.7' },
    '108-88-3': { physicalState: 'ppm', twaPpm: '50', twaMg: '', hCode: 'H225, H304, H315, H336, H361, H373', boilingPoint: '110.6' },
    '71-43-2': { physicalState: 'ppm', twaPpm: '1', twaMg: '', hCode: 'H225, H304, H315, H319, H340, H350, H372', boilingPoint: '80.1' },
    '67-64-1': { physicalState: 'ppm', twaPpm: '500', twaMg: '', hCode: 'H225, H319, H336', boilingPoint: '56.05' },
    '50-00-0': { physicalState: 'ppm', twaPpm: '0.3', twaMg: '', hCode: 'H301, H311, H314, H317, H330, H341, H350', boilingPoint: '-19.1' }
  }
  
  return knownData[casNumber] || null
}