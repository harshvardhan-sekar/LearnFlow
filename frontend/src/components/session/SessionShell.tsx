import { useSession } from "../../contexts/SessionContext";
import SessionStart from "./SessionStart";
import AssessmentModal from "./AssessmentModal";
import ReflectionModal from "./ReflectionModal";
import SessionSummary from "./SessionSummary";
import ThreePanelLayout from "../layout/ThreePanelLayout";

export default function SessionShell() {
  const {
    phase,
    loading,
    assessmentQuestions,
    assessmentType: _assessmentType,
    submitAssessment,
    submitReflection,
  } = useSession();

  switch (phase) {
    case "idle":
      return <SessionStart />;

    case "pre_assessment":
      return (
        <>
          <SessionStart />
          <AssessmentModal
            title="Pre-Session Assessment"
            questions={assessmentQuestions}
            onSubmit={submitAssessment}
            loading={loading}
          />
        </>
      );

    case "learning":
      return <ThreePanelLayout />;

    case "post_assessment":
      return (
        <>
          <ThreePanelLayout />
          <AssessmentModal
            title="Post-Session Assessment"
            questions={assessmentQuestions}
            onSubmit={submitAssessment}
            loading={loading}
          />
        </>
      );

    case "reflection":
      return (
        <>
          <ThreePanelLayout />
          <ReflectionModal onSubmit={submitReflection} loading={loading} />
        </>
      );

    case "summary":
      return <SessionSummary />;

    default:
      return <SessionStart />;
  }
}
