-- AlterTable
ALTER TABLE "analysis_results" ADD COLUMN     "assessment" JSONB,
ADD COLUMN     "frame_type" TEXT,
ALTER COLUMN "clothing_score" DROP NOT NULL,
ALTER COLUMN "posture_score" DROP NOT NULL;

-- AlterTable
ALTER TABLE "interview_simulations" ADD COLUMN     "question_feedback" JSONB;
