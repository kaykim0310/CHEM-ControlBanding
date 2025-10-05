import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download } from 'lucide-react';

interface ExportButtonProps {
  data: any[];
  filename: string;
}

export function ExportButton({ data, filename }: ExportButtonProps) {
  const exportToCSV = () => {
    if (!data || data.length === 0) return;

    // CSV 헤더 생성 (25개 열)
    const headers = [
      '공정명', '제품명', '화학물질명', '관용명및이명', 'CAS번호', '측정유무',
      '성상', '유소견자유무', 'TWA(ppm)값', 'TWA(mg)값', '측정(ppm)값', '측정(mg)값',
      'H-CODE값', 'H-CODE등급', 'CMR_C값', 'CMR_M값', 'CMR_R값', '물질구분',
      '하루취급량', '하루취급량단위', '함유량', '비산성', '사용온도', '끓는점', '밀폐환기상태'
    ];

    // CSV 데이터 생성
    const csvData = data.map(component => [
      component.processName || '',
      component.productName || '',
      component.chemicalName || '',
      component.commonName || '',
      component.casNumber || '',
      component.measurementStatus || '',
      component.physicalState || '',
      component.abnormalFindings || '',
      component.twaPpm || '',
      component.twaMg || '',
      component.measuredPpm || '',
      component.measuredMg || '',
      component.hCode || '',
      component.hCodeGrade || '',
      component.cmrC || '',
      component.cmrM || '',
      component.cmrR || '',
      component.substanceType || '',
      component.dailyHandlingAmount || '',
      component.dailyHandlingUnit || '',
      component.content || '',
      component.volatility || '',
      component.useTemperature || '',
      component.boilingPoint || '',
      component.ventilationStatus || ''
    ]);

    // CSV 문자열 생성
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // BOM 추가 (한글 깨짐 방지)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // 다운로드
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    console.log('🔍 엑셀 다운로드 시작');
    alert('엑셀 다운로드 버튼 클릭됨!'); // 버튼 클릭 확인용
    
    if (!data || data.length === 0) {
      console.log('❌ 데이터가 없음');
      alert('데이터가 없습니다!');
      return;
    }

    console.log('📊 데이터 개수:', data.length);

    try {
      // 간단한 CSV 형식으로 엑셀 파일 생성
      const headers = [
        '공정명', '제품명', '화학물질명', '관용명및이명', 'CAS번호', '측정유무',
        '성상', '유소견자유무', 'TWA(ppm)값', 'TWA(mg)값', '측정(ppm)값', '측정(mg)값',
        'H-CODE값', 'H-CODE등급', 'CMR_C값', 'CMR_M값', 'CMR_R값', '물질구분',
        '하루취급량', '하루취급량단위', '함유량', '비산성', '사용온도', '끓는점', '밀폐환기상태'
      ];

      const excelData = data.map(component => [
        component.processName || '',
        component.productName || '',
        component.chemicalName || '',
        component.commonName || '',
        component.casNumber || '',
        component.measurementStatus || '',
        component.physicalState || '',
        component.abnormalFindings || '',
        component.twaPpm || '',
        component.twaMg || '',
        component.measuredPpm || '',
        component.measuredMg || '',
        component.hCode || '',
        component.hCodeGrade || '',
        component.cmrC || '',
        component.cmrM || '',
        component.cmrR || '',
        component.substanceType || '',
        component.dailyHandlingAmount || '',
        component.dailyHandlingUnit || '',
        component.content || '',
        component.volatility || '',
        component.useTemperature || '',
        component.boilingPoint || '',
        component.ventilationStatus || ''
      ]);

      // CSV 형식으로 데이터 생성
      const csvContent = [
        headers.join(','),
        ...excelData.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // BOM 추가 (한글 깨짐 방지)
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { 
        type: 'application/vnd.ms-excel;charset=utf-8' 
      });

      // 다운로드 링크 생성
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.xls`;
      
      // 링크를 DOM에 추가하고 클릭
      document.body.appendChild(link);
      link.click();
      
      // 정리
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('✅ 엑셀 파일 다운로드 성공!');
      alert('엑셀 파일 다운로드 완료!');
      
    } catch (error) {
      console.error('❌ 엑셀 다운로드 오류:', error);
      alert('엑셀 다운로드 오류: ' + error.message);
    }
  };

  return (
    <div className="flex gap-2">
      <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
        <Download className="h-4 w-4" />
        CSV 다운로드
      </Button>
      <Button onClick={exportToExcel} variant="outline" className="flex items-center gap-2 bg-green-50 hover:bg-green-100">
        <Download className="h-4 w-4" />
        엑셀 다운로드
      </Button>
    </div>
  );
}