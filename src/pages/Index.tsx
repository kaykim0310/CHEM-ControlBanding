import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ExportButton } from '@/components/ExportButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, Image, Camera, Search, Download, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExtractedComponent {
  processName: string; // 1.공정명
  productName: string; // 2.제품명
  chemicalName: string; // 3.화학물질명(필수)
  commonName: string; // 4.관용명및이명
  casNumber: string; // 5.CAS번호
  measurementStatus: string; // 6.측정유무(필수) (유/무)
  physicalState: string; // 7.성상(필수) (mg/ppm)
  abnormalFindings: string; // 8.유소견자유무(필수) (유/무)
  twaPpm: string; // 9.TWA(ppm)값
  twaMg: string; // 10.TWA(mg)값
  measuredPpm: string; // 11.측정(ppm)값
  measuredMg: string; // 12.측정(mg)값
  hCode: string; // 13.H-CODE값
  hCodeGrade: string; // 14.H-CODE등급
  cmrC: string; // 15.CMR_C값
  cmrM: string; // 16.CMR_M값
  cmrR: string; // 17.CMR_R값
  substanceType: string; // 18.물질구분 (단일/혼합)
  dailyHandlingAmount: string; // 19.하루취급량
  dailyHandlingUnit: string; // 20.하루취급량단위
  content: string; // 21.함유량
  volatility: string; // 22.비산성
  useTemperature: string; // 23.사용온도
  boilingPoint: string; // 24.끓는점
  ventilationStatus: string; // 25.밀폐환기상태
  toxicityInfo?: ToxicityInfo;
}

interface ToxicityInfo {
  hazardClass: string;
  hazardStatement: string;
  precautionaryStatement: string;
  physicalProperties: {
    molecularWeight: string;
    boilingPoint: string;
    meltingPoint: string;
    density: string;
  };
  healthEffects: {
    acute: string;
    chronic: string;
    carcinogenicity: string;
  };
}

interface MSdsData {
  productName: string;
  components: ExtractedComponent[];
}

// 목업 독성 데이터
const mockToxicityData: Record<string, ToxicityInfo> = {
  '64-17-5': { // 에탄올
    hazardClass: 'Flammable liquid Category 2',
    hazardStatement: 'H225: 고인화성 액체 및 증기',
    precautionaryStatement: 'P210: 열, 스파크, 화염, 고온 표면으로부터 멀리하시오',
    physicalProperties: {
      molecularWeight: '46.07 g/mol',
      boilingPoint: '78.37°C',
      meltingPoint: '-114.1°C',
      density: '0.789 g/cm³'
    },
    healthEffects: {
      acute: '중추신경계 억제, 현기증, 졸음',
      chronic: '간 손상, 신경계 영향',
      carcinogenicity: 'IARC Group 1 (인체 발암물질)'
    }
  },
  '67-56-1': { // 메탄올
    hazardClass: 'Acute toxicity Category 3',
    hazardStatement: 'H301+H311+H331: 삼키거나, 피부에 접촉하거나, 흡입하면 유독함',
    precautionaryStatement: 'P280: 보호장갑, 보호의, 보안경, 안면보호구를 착용하시오',
    physicalProperties: {
      molecularWeight: '32.04 g/mol',
      boilingPoint: '64.7°C',
      meltingPoint: '-97.6°C',
      density: '0.792 g/cm³'
    },
    healthEffects: {
      acute: '시신경 손상, 실명, 중추신경계 억제',
      chronic: '간 손상, 신경계 영향',
      carcinogenicity: 'IARC Group 2B (인체 발암 가능물질)'
    }
  },
  '108-88-3': { // 톨루엔
    hazardClass: 'Flammable liquid Category 2',
    hazardStatement: 'H225: 고인화성 액체 및 증기',
    precautionaryStatement: 'P210: 열, 스파크, 화염, 고온 표면으로부터 멀리하시오',
    physicalProperties: {
      molecularWeight: '92.14 g/mol',
      boilingPoint: '110.6°C',
      meltingPoint: '-95°C',
      density: '0.867 g/cm³'
    },
    healthEffects: {
      acute: '중추신경계 억제, 현기증, 두통',
      chronic: '신경계 영향, 생식독성',
      carcinogenicity: 'IARC Group 3 (인체 발암성 분류 불가)'
    }
  }
};

export default function Index() {
  const [msdsData, setMsdsData] = useState<MSdsData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processName, setProcessName] = useState<string>(''); // 공정명
  const [productName, setProductName] = useState<string>(''); // 제품명
  const [googleSheetUrl, setGoogleSheetUrl] = useState<string>(''); // 구글 시트 URL
  // KOSHA 데이터 구글 시트 URL 고정 (TSV 형식으로 변경 - 한글 깨짐 방지)
  const koshaDataUrl = 'https://docs.google.com/spreadsheets/d/1Djfd3vd9z01vaflVDxiRSr6NnktUxiOd/export?format=tsv';
  const { toast } = useToast();

  // 테이블 ref와 마우스 휠 좌우 스크롤 기능
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tableContainer = tableRef.current;
    if (!tableContainer) return;

    const handleWheel = (e: WheelEvent) => {
      // 세로 휠 움직임을 가로 스크롤로 변환
      if (e.deltaY !== 0) {
        e.preventDefault();
        tableContainer.scrollLeft += e.deltaY;
      }
    };

    tableContainer.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      tableContainer.removeEventListener('wheel', handleWheel);
    };
  }, [msdsData]); // msdsData가 변경될 때마다 이벤트 리스너 재설정

  // 구글 시트 URL을 CSV URL로 변환
  const convertToCSVUrl = (sheetUrl: string): string => {
    try {
      // 구글 시트 URL에서 스프레드시트 ID 추출
      const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        const spreadsheetId = match[1];
        // CSV 다운로드 URL로 변환
        return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
      }
      throw new Error('유효하지 않은 구글 시트 URL입니다.');
    } catch (error) {
      throw new Error('구글 시트 URL 형식이 올바르지 않습니다.');
    }
  };

  // CSV 데이터를 파싱하여 컴포넌트로 변환
  const parseCSVToComponents = (csvText: string): ExtractedComponent[] => {
    const lines = csvText.split('\n').filter(line => line.trim());
    const components: ExtractedComponent[] = [];
    
    if (lines.length < 2) {
      throw new Error('구글 시트에 데이터가 없습니다.');
    }
    
    // 첫 번째 줄에서 헤더 읽기
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine).map(col => col.trim().toLowerCase());
    console.log('구글 시트 헤더:', headers);
    
    // 헤더에서 각 열의 인덱스 찾기 (정확한 매칭)
    const findColumnIndex = (searchTerms: string[]): number => {
      for (const term of searchTerms) {
        const index = headers.findIndex(header => {
          const cleanHeader = header.replace(/[^\w가-힣]/g, '').toLowerCase();
          const cleanTerm = term.replace(/[^\w가-힣]/g, '').toLowerCase();
          return cleanHeader === cleanTerm || 
                 cleanHeader.includes(cleanTerm) || 
                 cleanTerm.includes(cleanHeader);
        });
        if (index !== -1) return index;
      }
      return -1;
    };
    
    // 구글 시트 열 제목과 25개 항목 매칭
    const productNameIndex = findColumnIndex(['제품명', 'product']);
    const chemicalNameIndex = findColumnIndex(['화학물질명', 'chemical']);
    const casNumberIndex = findColumnIndex(['cas번호', 'cas 번호', 'cas', '식별번호']);
    const contentIndex = findColumnIndex(['함유량', 'content', '함량']);
    
    console.log('열 인덱스 매핑:');
    console.log('제품명:', productNameIndex, headers[productNameIndex]);
    console.log('화학물질명:', chemicalNameIndex, headers[chemicalNameIndex]);
    console.log('CAS번호:', casNumberIndex, headers[casNumberIndex]);
    console.log('함유량:', contentIndex, headers[contentIndex]);
    
    // 데이터 행 처리 (헤더 제외)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      console.log(`행 ${i + 1} 원본:`, line);
      
      // CSV 파싱
      const columns = parseCSVLine(line);
      
      console.log(`행 ${i + 1} 파싱 결과:`, columns);
      console.log(`행 ${i + 1} 컬럼 수:`, columns.length);
      
      // 최소한의 데이터가 있는지 확인
      if (columns.length < 2) {
        console.log(`행 ${i + 1}: 데이터가 부족하여 건너뜀`);
        continue;
      }
      
      // 데이터 추출 (인덱스가 유효한 경우만)
      const extractedProductName = productNameIndex !== -1 && columns[productNameIndex] ? columns[productNameIndex].trim() : '';
      const extractedChemicalName = chemicalNameIndex !== -1 && columns[chemicalNameIndex] ? columns[chemicalNameIndex].trim() : '화학물질명 미확인';
      const extractedCasNumber = casNumberIndex !== -1 && columns[casNumberIndex] ? columns[casNumberIndex].trim() : '';
      const extractedContent = contentIndex !== -1 && columns[contentIndex] ? columns[contentIndex].trim() : '';
      
      console.log(`행 ${i + 1} 추출 데이터:`, {
        제품명: extractedProductName,
        화학물질명: extractedChemicalName,
        CAS번호: extractedCasNumber,
        함유량: extractedContent
      });
      
      // 필수 데이터 확인
      if (!extractedChemicalName || extractedChemicalName === '화학물질명 미확인') {
        if (!extractedCasNumber) {
          console.log(`행 ${i + 1}: 화학물질명과 CAS번호가 모두 없어서 건너뜀`);
          continue;
        }
      }
      
      // 25개 항목에 매핑 (구글 시트 데이터를 해당 위치에 배치)
      components.push({
        processName: processName || '', // 1.공정명 (사용자 입력)
        productName: productName || extractedProductName, // 2.제품명 (구글시트 → 2번째 열)
        chemicalName: extractedChemicalName, // 3.화학물질명 (구글시트 → 3번째 열)
        commonName: '', // 4.관용명및이명
        casNumber: extractedCasNumber, // 5.CAS번호 (구글시트 → 5번째 열)
        measurementStatus: '무', // 6.측정유무
        physicalState: 'mg', // 7.성상
        abnormalFindings: '무', // 8.유소견자유무
        twaPpm: '', // 9.TWA(ppm)값
        twaMg: '', // 10.TWA(mg)값
        measuredPpm: '', // 11.측정(ppm)값
        measuredMg: '', // 12.측정(mg)값
        hCode: '', // 13.H-CODE값
        hCodeGrade: '', // 14.H-CODE등급
        cmrC: '', // 15.CMR_C값
        cmrM: '', // 16.CMR_M값
        cmrR: '', // 17.CMR_R값
        substanceType: '단일', // 18.물질구분
        dailyHandlingAmount: '', // 19.하루취급량
        dailyHandlingUnit: 'kg', // 20.하루취급량단위
        content: extractedContent, // 21.함유량 (구글시트 → 21번째 열)
        volatility: '', // 22.비산성
        useTemperature: '', // 23.사용온도
        boilingPoint: '', // 24.끓는점
        ventilationStatus: '개방', // 25.밀폐환기상태
        toxicityInfo: mockToxicityData[extractedCasNumber] // CAS 번호로 독성정보 매칭
      });
    }
    
    console.log('최종 파싱된 컴포넌트 수:', components.length);
    return components;
  };

  // CSV 라인을 정교하게 파싱하는 함수
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // 연속된 따옴표는 하나의 따옴표로 처리
          current += '"';
          i++; // 다음 따옴표 건너뛰기
        } else {
          // 따옴표 시작/끝
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // 따옴표 밖의 쉼표는 구분자
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // 마지막 컬럼 추가
    result.push(current.trim());
    
    return result;
  };

  // KOSHA 데이터 구글 시트에서 데이터 가져와서 매핑하는 함수
  const loadKoshaDataFromSheet = async (components: ExtractedComponent[]): Promise<ExtractedComponent[]> => {
    if (!koshaDataUrl || !koshaDataUrl.trim()) {
      console.log('KOSHA 데이터 URL이 설정되지 않음');
      return components;
    }

    try {
      console.log('KOSHA 데이터 구글 시트에서 데이터 로딩 시작...');
      
      // KOSHA 데이터 구글 시트 URL을 TSV URL로 변환 (한글 깨짐 방지)
      const koshaCSVUrl = koshaDataUrl; // 이미 TSV 형식으로 설정됨
      
      // CSV 데이터 가져오기
      const response = await fetch(koshaCSVUrl);
      if (!response.ok) {
        throw new Error('KOSHA 데이터 구글 시트에 접근할 수 없습니다.');
      }

      const csvText = await response.text();
      // TSV 형식이므로 탭으로 분리
      const lines = csvText.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        console.log('KOSHA 데이터 시트에 데이터가 없음');
        return components;
      }

      // 헤더 파싱 (TSV - 탭으로 구분)
      const headers = lines[0].split('\t').map(h => h.toLowerCase().trim());
      console.log('KOSHA 데이터 헤더:', headers);

      // findColumnIndex 함수 정의 (KOSHA 데이터용)
      const findKoshaColumnIndex = (headers: string[], searchTerms: string[]): number => {
        for (const term of searchTerms) {
          const index = headers.findIndex(header => 
            header.toLowerCase().includes(term.toLowerCase())
          );
          if (index !== -1) return index;
        }
        return -1;
      };

      // 필요한 열 인덱스 찾기 - 실제 구글 시트 열 제목에 맞게 수정
      const casIndex = findKoshaColumnIndex(headers, ['5.cas번호', 'cas번호', '5.cas', 'cas']);
      const stateIndex = findKoshaColumnIndex(headers, ['7.성상(필수)', '7.성상', '성상', 'state']);
      const twaPpmIndex = findKoshaColumnIndex(headers, ['9.twa(ppm)값', '9.twa(ppm)', 'twa(ppm)', 'ppm']);
      const twaMgIndex = findKoshaColumnIndex(headers, ['10.twa(mg)값', '10.twa(mg)', 'twa(mg)', 'mg']);
      const hCodeIndex = findKoshaColumnIndex(headers, ['13.h-code값', '13.h-code', 'h-code', 'hcode']);
      const boilingPointIndex = findKoshaColumnIndex(headers, ['24.끓는점', '끓는점', 'boiling point', 'bp']);

      console.log('KOSHA 데이터 열 인덱스:', {
        cas: casIndex,
        state: stateIndex,
        twaPpm: twaPpmIndex,
        twaMg: twaMgIndex,
        hCode: hCodeIndex,
        boilingPoint: boilingPointIndex
      });

      // KOSHA 데이터를 CAS 번호로 매핑
      const koshaDataMap = new Map();
      
      for (let i = 1; i < lines.length; i++) {
        // TSV 형식이므로 탭으로 분리
        const columns = lines[i].split('\t');
        
        if (casIndex !== -1 && columns[casIndex]) {
          const casNumber = columns[casIndex].trim();
          const koshaData = {
            physicalState: stateIndex !== -1 ? columns[stateIndex]?.trim() || '' : '',
            twaPpm: twaPpmIndex !== -1 ? columns[twaPpmIndex]?.trim() || '' : '',
            twaMg: twaMgIndex !== -1 ? columns[twaMgIndex]?.trim() || '' : '',
            hCode: hCodeIndex !== -1 ? columns[hCodeIndex]?.trim() || '' : '',
            boilingPoint: boilingPointIndex !== -1 ? columns[boilingPointIndex]?.trim() || '' : ''
          };
          
          koshaDataMap.set(casNumber, koshaData);
          console.log(`KOSHA 데이터 매핑: ${casNumber}`, koshaData);
        }
      }

      // 컴포넌트에 KOSHA 데이터 적용
      let appliedCount = 0;
      components.forEach(component => {
        if (component.casNumber && koshaDataMap.has(component.casNumber)) {
          const koshaData = koshaDataMap.get(component.casNumber);
          
          // 7번. 성상
          if (koshaData.physicalState) {
            component.physicalState = koshaData.physicalState;
          }
          
          // 9번. TWA(ppm)값 - 성상이 ppm이면 적용
          if (koshaData.twaPpm && (component.physicalState === 'ppm' || koshaData.physicalState === 'ppm')) {
            component.twaPpm = koshaData.twaPpm;
          }
          
          // 10번. TWA(mg)값 - 성상이 mg이면 적용
          if (koshaData.twaMg && (component.physicalState === 'mg' || koshaData.physicalState === 'mg')) {
            component.twaMg = koshaData.twaMg;
          }
          
          // 13번. H-CODE값
          if (koshaData.hCode) {
            component.hCode = koshaData.hCode;
          }
          
          // 24번. 끓는점
          if (koshaData.boilingPoint) {
            component.boilingPoint = koshaData.boilingPoint;
          }
          
          appliedCount++;
          console.log(`${component.casNumber}에 KOSHA 데이터 적용 완료`);
        }
      });

      console.log(`KOSHA 데이터 적용 완료: ${appliedCount}개 화학물질`);
      
      toast({
        title: 'KOSHA 데이터 적용 완료',
        description: `${appliedCount}개 화학물질에 KOSHA 데이터가 적용되었습니다.`
      });

      return components;

    } catch (error) {
      console.error('KOSHA 데이터 로딩 오류:', error);
      toast({
        title: 'KOSHA 데이터 로딩 실패',
        description: 'KOSHA 데이터를 불러오는 중 오류가 발생했습니다. 기본 데이터로 진행합니다.',
        variant: 'destructive'
      });
      return components;
    }
  };
  // 구글 시트에서 데이터 불러오기
  const loadFromGoogleSheet = async () => {
    if (!googleSheetUrl.trim()) {
      toast({
        title: '구글 시트 URL 필요',
        description: '구글 시트 URL을 입력해주세요.',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      // 구글 시트 URL을 CSV URL로 변환
      const csvUrl = convertToCSVUrl(googleSheetUrl);
      setProgress(20);

      // CSV 데이터 가져오기
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error('구글 시트에 접근할 수 없습니다. 시트가 공개되어 있는지 확인해주세요.');
      }

      setProgress(40);
      const csvText = await response.text();
      
      // CSV 데이터를 컴포넌트로 변환
      let components = parseCSVToComponents(csvText);
      setProgress(60);

      if (components.length === 0) {
        throw new Error('구글 시트에서 유효한 데이터를 찾을 수 없습니다.');
      }

      // 고정된 KOSHA 데이터 URL 사용
        toast({
          title: 'KOSHA 데이터 로딩 시작',
          description: 'KOSHA 데이터 구글 시트에서 추가 정보를 가져오고 있습니다...'
        });

        setProgress(70);
        
        // KOSHA 데이터 구글 시트에서 데이터 로딩
        const updatedComponents = await loadKoshaDataFromSheet(components);
        components = updatedComponents;

      setMsdsData({
        productName: productName || '제품명을 입력해주세요',
        components
      });

      setProgress(100);
      setIsProcessing(false);

      toast({
        title: '데이터 불러오기 완료',
        description: `${components.length}개의 화학물질 정보를 불러왔습니다.`
      });

    } catch (error) {
      console.error('구글 시트 불러오기 오류:', error);
      setIsProcessing(false);
      toast({
        title: '데이터 불러오기 실패',
        description: error instanceof Error ? error.message : '구글 시트에서 데이터를 불러오는 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    }
  };

  // 별도 KOSHA 데이터 로딩 함수
  const loadKoshaData = async () => {
    if (!msdsData || !msdsData.components || msdsData.components.length === 0) {
      toast({
        title: 'MSDS 데이터 필요',
        description: '먼저 구글 시트에서 MSDS 데이터를 불러와주세요.',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      toast({
        title: 'KOSHA 데이터 로딩 시작',
        description: '고정된 KOSHA 데이터 구글 시트에서 추가 정보를 가져오고 있습니다...'
      });

      setProgress(50);
      
      // KOSHA 데이터 구글 시트에서 데이터 로딩
      const updatedComponents = await loadKoshaDataFromSheet([...msdsData.components]);
      
      setProgress(90);

      // 업데이트된 데이터로 상태 갱신
      setMsdsData({
        ...msdsData,
        components: updatedComponents
      });

      setProgress(100);
      setIsProcessing(false);

      toast({
        title: 'KOSHA 데이터 로딩 완료',
        description: 'KOSHA 데이터가 성공적으로 추가되었습니다.'
      });

    } catch (error) {
      console.error('KOSHA 데이터 로딩 오류:', error);
      setIsProcessing(false);
      toast({
        title: 'KOSHA 데이터 로딩 실패',
        description: error instanceof Error ? error.message : 'KOSHA 데이터를 불러오는 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    }
  };
  const getToxicityBadgeColor = (hazardClass: string) => {
    if (hazardClass.toLowerCase().includes('acute toxicity')) return 'destructive';
    if (hazardClass.toLowerCase().includes('flammable')) return 'secondary';
    if (hazardClass.toLowerCase().includes('corrosive')) return 'destructive';
    return 'default';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">MSDS 분석기</h1>
          <p className="text-lg text-gray-600">
            Gemini에서 추출한 화학물질 정보를 구글 시트로 불러와 25개 항목으로 정리합니다
          </p>
        </div>

        {/* 기본 정보 입력 섹션 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              기본 정보 입력
            </CardTitle>
            <CardDescription>
              분석할 MSDS 문서의 기본 정보를 입력해주세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="process-name">공정명</Label>
                <Input
                  id="process-name"
                  type="text"
                  placeholder="예: 도장공정, 세척공정 등"
                  value={processName}
                  onChange={(e) => setProcessName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-name">제품명</Label>
                <Input
                  id="product-name"
                  type="text"
                  placeholder="예: 에탄올 용액, 아세톤 등"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 구글 시트 불러오기 섹션 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              구글 시트에서 데이터 불러오기
            </CardTitle>
            <CardDescription>
              Gemini에서 추출한 화학물질 정보가 저장된 구글 시트 URL을 입력하세요
              <br />
              <span className="text-sm text-blue-600">
                💡 구글 시트는 "링크가 있는 모든 사용자"로 공개되어야 합니다
              </span>
              <br />
              <span className="text-sm text-green-600">
                🚀 KOSHA 데이터 구글 시트 연동 - 추가 정보 자동 매핑!
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="google-sheet-url">구글 시트 URL</Label>
                <Input
                  id="google-sheet-url"
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={googleSheetUrl}
                  onChange={(e) => setGoogleSheetUrl(e.target.value)}
                />
              </div>
              
              <div className="p-3 bg-green-50 rounded border-l-4 border-green-400">
                <p className="text-sm text-green-800 font-medium">🚀 KOSHA 데이터 자동 연동</p>
                <p className="text-xs text-green-700 mt-1">
                  고정된 KOSHA 데이터 구글 시트에서 자동으로 추가 정보를 가져옵니다. 별도 설정이 필요하지 않습니다.
                </p>
              </div>
              
              {/* KOSHA 데이터 로딩 버튼 - MSDS 데이터가 있을 때만 표시 */}
              {msdsData && msdsData.components && msdsData.components.length > 0 && (
                <Button 
                  onClick={loadKoshaData}
                  disabled={isProcessing}
                  className="w-full bg-green-600 hover:bg-green-700"
                  variant="default"
                >
                  {isProcessing ? (
                    <>
                      <Search className="h-4 w-4 animate-spin mr-2" />
                      KOSHA 데이터 로딩 중...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      KOSHA 데이터 추가 로딩
                    </>
                  )}
                </Button>
              )}
              
              <Button 
                onClick={loadFromGoogleSheet}
                disabled={isProcessing || !googleSheetUrl.trim()}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Search className="h-4 w-4 animate-spin mr-2" />
                    데이터 불러오는 중...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    구글 시트에서 불러오기
                  </>
                )}
              </Button>
              
              {isProcessing && (
                <div className="space-y-2">
                  <Progress value={progress} className="w-full" />
                  <p className="text-sm text-gray-600 text-center">
                    {progress < 70 ? '구글 시트에서 데이터를 가져오고 있습니다...' : 'KOSHA 데이터를 매핑하고 있습니다...'}
                  </p>
                </div>
              )}
              
              <div className="mt-4 p-4 bg-amber-50 rounded-lg">
                <h4 className="font-semibold text-amber-800 mb-2">구글 시트 설정 방법</h4>
                <ol className="text-sm text-amber-700 space-y-1">
                  <li>1. Gemini에서 MSDS 데이터를 추출하여 구글 시트에 저장</li>
                  <li>2. <strong>구글 시트 첫 번째 행에 열 제목 입력</strong> (제품명, 화학물질명, CAS 번호, 함유량 등)</li>
                  <li>3. 구글 시트 우상단 "공유" 버튼 클릭</li>
                  <li>4. "링크가 있는 모든 사용자"로 권한 설정</li>
                  <li>5. "링크 복사"하여 위 입력란에 붙여넣기</li>
                  <li>6. "구글 시트에서 불러오기" 버튼 클릭</li>
                  <li>7. <strong>같은 이름의 열끼리 자동 매칭!</strong></li>
                  <li>8. <strong>KOSHA 데이터 구글 시트 연동!</strong></li>
                </ol>
                
                <div className="mt-3 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
                  <p className="text-sm text-blue-800 font-medium">🔗 열 제목 매칭 규칙:</p>
                  <ul className="text-xs text-blue-700 mt-1 space-y-1">
                    <li>• <strong>제품명</strong> → 2번째 열 (제품명)</li>
                    <li>• <strong>화학물질명</strong> → 3번째 열 (화학물질명)</li>
                    <li>• <strong>CAS 번호/식별번호</strong> → 5번째 열 (CAS번호)</li>
                    <li>• <strong>함유량(%)</strong> → 21번째 열 (함유량)</li>
                  </ul>
                </div>
                
                <div className="mt-3 p-3 bg-green-50 rounded border-l-4 border-green-400">
                  <p className="text-sm text-green-800 font-medium">🚀 KOSHA 데이터 구글 시트 연동:</p>
                  <ul className="text-xs text-green-700 mt-1 space-y-1">
                    <li>• <strong>CAS 번호 매칭:</strong> 첫 번째 시트의 CAS 번호와 KOSHA 시트의 CAS 번호를 매칭</li>
                    <li>• <strong>7번. 성상:</strong> KOSHA 시트의 "성상" 열 → 25개 항목의 7번째 열</li>
                    <li>• <strong>9-10번. TWA값:</strong> 성상이 ppm이면 TWA(ppm), mg이면 TWA(mg)에 적용</li>
                    <li>• <strong>13번. H-CODE:</strong> KOSHA 시트의 "H-CODE" 열 → 25개 항목의 13번째 열</li>
                    <li>• <strong>24번. 끓는점:</strong> KOSHA 시트의 "끓는점" 열 → 25개 항목의 24번째 열</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 결과 표시 */}
        {msdsData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                추출 결과
              </CardTitle>
              <CardDescription className="flex items-center justify-between">
                <div>
                  제품명: <span className="font-semibold">{msdsData.productName}</span>
                  {!productName && (
                    <span className="text-amber-600 ml-2">
                      (위에서 제품명을 입력해주세요)
                    </span>
                  )}
                </div>
                <ExportButton data={msdsData.components} filename={`MSDS_분석결과_${new Date().toISOString().split('T')[0]}`} />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="components" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="components">화학물질위험성평가 업로드용</TabsTrigger>
                  <TabsTrigger value="inventory">화학물질인벤토리</TabsTrigger>
                </TabsList>
                
                <TabsContent value="components" className="space-y-4">
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">화학물질위험성평가 업로드용 데이터 (25개 항목)</h4>
                    <p className="text-sm text-blue-700">
                      구글 시트에서 불러온 화학물질 정보가 25개 항목으로 정리되었습니다. 
                      <br />
                      <span className="font-semibold text-green-700">🚀 KOSHA 데이터 구글 시트에서 자동 매핑한 추가 정보가 포함되어 있습니다!</span>
                      <br />
                      화학물질위험성평가 시스템에 업로드할 수 있는 형태입니다.
                    </p>
                  </div>
                  
                  <div ref={tableRef} className="table-scroll-container overflow-x-auto max-h-[200px] overflow-y-auto border rounded-lg shadow-sm bg-white">
                    <Table className="min-w-full border-collapse">
                      <TableHeader className="sticky top-0 bg-white z-10">
                        <TableRow className="text-xs">
                          <TableHead className="min-w-[80px]">공정명</TableHead>
                          <TableHead className="min-w-[100px]">제품명</TableHead>
                          <TableHead className="min-w-[120px]">화학물질명*</TableHead>
                          <TableHead className="min-w-[100px]">관용명및이명</TableHead>
                          <TableHead className="min-w-[100px]">CAS번호</TableHead>
                          <TableHead className="min-w-[80px]">측정유무*</TableHead>
                          <TableHead className="min-w-[80px]">성상*</TableHead>
                          <TableHead className="min-w-[100px]">유소견자유무*</TableHead>
                          <TableHead className="min-w-[80px]">TWA(ppm)</TableHead>
                          <TableHead className="min-w-[80px]">TWA(mg)</TableHead>
                          <TableHead className="min-w-[80px]">측정(ppm)</TableHead>
                          <TableHead className="min-w-[80px]">측정(mg)</TableHead>
                          <TableHead className="min-w-[80px]">H-CODE</TableHead>
                          <TableHead className="min-w-[80px]">H-CODE등급</TableHead>
                          <TableHead className="min-w-[60px]">CMR_C</TableHead>
                          <TableHead className="min-w-[60px]">CMR_M</TableHead>
                          <TableHead className="min-w-[60px]">CMR_R</TableHead>
                          <TableHead className="min-w-[80px]">물질구분</TableHead>
                          <TableHead className="min-w-[100px]">하루취급량</TableHead>
                          <TableHead className="min-w-[80px]">취급량단위</TableHead>
                          <TableHead className="min-w-[80px]">함유량</TableHead>
                          <TableHead className="min-w-[80px]">비산성</TableHead>
                          <TableHead className="min-w-[80px]">사용온도</TableHead>
                          <TableHead className="min-w-[80px]">끓는점</TableHead>
                          <TableHead className="min-w-[100px]">밀폐환기상태</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {msdsData.components.map((component, index) => (
                          <TableRow key={index} className="text-xs">
                            <TableCell>{component.processName}</TableCell>
                            <TableCell>{component.productName}</TableCell>
                            <TableCell className="font-medium">{component.chemicalName}</TableCell>
                            <TableCell>{component.commonName}</TableCell>
                            <TableCell>{component.casNumber}</TableCell>
                            <TableCell>{component.measurementStatus}</TableCell>
                            <TableCell>{component.physicalState}</TableCell>
                            <TableCell>{component.abnormalFindings}</TableCell>
                            <TableCell>{component.twaPpm}</TableCell>
                            <TableCell>{component.twaMg}</TableCell>
                            <TableCell>{component.measuredPpm}</TableCell>
                            <TableCell>{component.measuredMg}</TableCell>
                            <TableCell>{component.hCode}</TableCell>
                            <TableCell>{component.hCodeGrade}</TableCell>
                            <TableCell>{component.cmrC}</TableCell>
                            <TableCell>{component.cmrM}</TableCell>
                            <TableCell>{component.cmrR}</TableCell>
                            <TableCell>{component.substanceType}</TableCell>
                            <TableCell>{component.dailyHandlingAmount}</TableCell>
                            <TableCell>{component.dailyHandlingUnit}</TableCell>
                            <TableCell>{component.content}</TableCell>
                            <TableCell>{component.volatility}</TableCell>
                            <TableCell>{component.useTemperature}</TableCell>
                            <TableCell>{component.boilingPoint}</TableCell>
                            <TableCell>{component.ventilationStatus}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                
                <TabsContent value="inventory" className="space-y-4">
                  <div className="mb-4 p-4 bg-green-50 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">화학물질인벤토리</h4>
                    <p className="text-sm text-green-700">
                      추출된 화학물질들의 기본 정보와 독성 데이터를 정리한 인벤토리입니다.
                    </p>
                  </div>
                  {msdsData.components.filter(c => c.toxicityInfo).map((component, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-orange-500" />
                          {component.chemicalName} ({component.casNumber})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-semibold mb-2">위험성 분류</h4>
                            <Badge variant={getToxicityBadgeColor(component.toxicityInfo!.hazardClass) as any}>
                              {component.toxicityInfo!.hazardClass}
                            </Badge>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">위험 문구</h4>
                            <p className="text-sm text-gray-600">{component.toxicityInfo!.hazardStatement}</p>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-semibold mb-2">예방 조치 문구</h4>
                          <p className="text-sm text-gray-600">{component.toxicityInfo!.precautionaryStatement}</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-semibold mb-2">물리화학적 특성</h4>
                            <div className="space-y-1 text-sm">
                              <p><span className="font-medium">분자량:</span> {component.toxicityInfo!.physicalProperties.molecularWeight}</p>
                              <p><span className="font-medium">끓는점:</span> {component.toxicityInfo!.physicalProperties.boilingPoint}</p>
                              <p><span className="font-medium">녹는점:</span> {component.toxicityInfo!.physicalProperties.meltingPoint}</p>
                              <p><span className="font-medium">밀도:</span> {component.toxicityInfo!.physicalProperties.density}</p>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">건강 영향</h4>
                            <div className="space-y-1 text-sm">
                              <p><span className="font-medium">급성:</span> {component.toxicityInfo!.healthEffects.acute}</p>
                              <p><span className="font-medium">만성:</span> {component.toxicityInfo!.healthEffects.chronic}</p>
                              <p><span className="font-medium">발암성:</span> {component.toxicityInfo!.healthEffects.carcinogenicity}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {msdsData.components.filter(c => c.toxicityInfo).length === 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        독성 정보가 있는 화학물질이 없습니다.
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}