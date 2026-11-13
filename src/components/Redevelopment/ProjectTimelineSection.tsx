import React from 'react';
import { Clock, Calendar, CheckCircle2, AlertCircle, FileText, Bookmark, ShieldAlert, ShieldCheck } from 'lucide-react';
import { EvidenceBadge } from './EvidenceBadge';
import type { RedevelopmentLineageDetailResponse, RedevelopmentMilestonePublic } from '../../types/redevelopmentApi';

interface ProjectTimelineSectionProps {
  lineageDetail: RedevelopmentLineageDetailResponse['lineage'] | null;
  isLoading: boolean;
}

export const ProjectTimelineSection: React.FC<ProjectTimelineSectionProps> = ({
  lineageDetail,
  isLoading,
}) => {
  const timelineMilestones: RedevelopmentMilestonePublic[] = React.useMemo(() => {
    if (lineageDetail?.timeline && lineageDetail.timeline.length > 0) {
      return [...lineageDetail.timeline].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }
    return [];
  }, [lineageDetail]);

  const officialCount = timelineMilestones.filter((m) => m.evidenceClass === 'OFFICIAL').length;
  const referenceCount = timelineMilestones.filter((m) => m.evidenceClass === 'REFERENCE').length;
  const projectMilestonesCount = timelineMilestones.filter(
    (m) => (m.category || 'PROJECT_MILESTONE') === 'PROJECT_MILESTONE'
  ).length;
  const backgroundMilestonesCount = timelineMilestones.filter(
    (m) => m.category === 'BACKGROUND_HISTORY'
  ).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              정비사업 추진 마일스톤 타임라인 (Project Timeline)
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            프로젝트 자체의 법정 인허가 절차와 과거 배경 이력을 명확히 구분하고, 인가일자와 고시일자를 독립 검증하여 표기합니다.
          </p>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 font-medium">
            사업 법정절차: {projectMilestonesCount}건
          </span>
          {backgroundMilestonesCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/60 text-purple-300 font-medium">
              사전 배경이력: {backgroundMilestonesCount}건
            </span>
          )}
          <span className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/60 text-blue-300 font-medium">
            공식 사실: {officialCount}건
          </span>
          {referenceCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 text-amber-400 font-medium">
              참고 자료: {referenceCount}건
            </span>
          )}
        </div>
      </div>

      {/* Timeline List */}
      {timelineMilestones.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          등록된 공식 마일스톤 데이터가 없거나 확인 중입니다.
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-6 border-l-2 border-slate-800 ml-2 sm:ml-3">
          {timelineMilestones.map((item) => {
            const isOfficial = item.evidenceClass === 'OFFICIAL';
            const isEligible = item.calculationEligibility === 'ELIGIBLE';
            const isBackground = item.category === 'BACKGROUND_HISTORY';

            return (
              <div key={item.milestoneId} className="relative group">
                {/* Dot */}
                <div
                  className={`absolute -left-[31px] sm:-left-[39px] top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    isBackground
                      ? 'bg-purple-500 border-slate-900 shadow-sm shadow-purple-500/30'
                      : isOfficial
                      ? 'bg-emerald-500 border-slate-900 shadow-sm shadow-emerald-500/30'
                      : 'bg-amber-500 border-slate-900 shadow-sm shadow-amber-500/30'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                </div>

                {/* Card */}
                <div
                  className={`border rounded-xl p-3.5 sm:p-4 transition-colors ${
                    isBackground
                      ? 'bg-purple-950/20 border-purple-900/60 hover:border-purple-800'
                      : 'bg-slate-950 border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-slate-200">
                        {item.name}
                      </span>
                      {isBackground ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-950/90 border border-purple-700 text-purple-300">
                          사전 배경 이력 (법정 절차 외)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-700 text-emerald-300">
                          사업 법정 절차
                        </span>
                      )}
                      {isOfficial ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-950/80 border border-blue-800 text-blue-300">
                          공식 사실
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-amber-300">
                          참고 자료
                        </span>
                      )}
                      <EvidenceBadge level={item.evidenceLevel} size="sm" />
                      {!isEligible && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          계산 제외
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{item.date ?? '확인 불가'}</span>
                    </div>
                  </div>

                  {isBackground && (
                    <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-purple-950/40 border border-purple-900/50 text-[11px] text-purple-300/90 flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>현재 도심 공공주택 복합사업 지정 이전의 종전 구역 해제 등 과거 배경 이력이며, 현 사업의 법정 추진 절차에 산입되지 않습니다.</span>
                    </div>
                  )}

                  {/* Dual Date Specification (Approval vs Notice / Filing) */}
                  {(item.approvalDate || item.noticeDate || item.filingDate || item.occurrenceDate) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800/60 text-xs">
                      {item.approvalDate && (
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <span className="text-slate-500 font-medium">행정인가(승인):</span>
                          <span className="font-semibold text-slate-200">{item.approvalDate}</span>
                        </div>
                      )}
                      {item.noticeDate && (
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <span className="text-slate-500 font-medium">고시공고:</span>
                          <span className="font-semibold text-slate-200">{item.noticeDate}</span>
                          {item.noticeNumber && (
                            <span className="text-[11px] text-slate-400">({item.noticeNumber})</span>
                          )}
                        </div>
                      )}
                      {item.filingDate && (
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <span className="text-slate-500 font-medium">신고(수리):</span>
                          <span className="font-semibold text-slate-200">{item.filingDate}</span>
                        </div>
                      )}
                      {item.occurrenceDate && !item.approvalDate && !item.filingDate && (
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <span className="text-slate-500 font-medium">발생일자:</span>
                          <span className="font-semibold text-slate-200">{item.occurrenceDate}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {item.notes || item.name}
                  </p>

                  <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-500">
                    <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>근거 문서: {item.sourceText || '공적 기록'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

