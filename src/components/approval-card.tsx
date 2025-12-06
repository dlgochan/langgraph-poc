"use client";

import { AlertTriangle, CheckCircle, XCircle, FileText, Search, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { InterruptData } from "@/types/workflow";

interface ApprovalCardProps {
  interruptData: InterruptData;
  onApprove: () => void;
  onReject: () => void;
  isLoading: boolean;
}

const taskTypeConfig: Record<
  string,
  { icon: React.ReactNode; label: string; variant: "default" | "destructive" | "warning" | "success" }
> = {
  destructive: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: "위험한 작업",
    variant: "destructive",
  },
  create: {
    icon: <FileText className="h-4 w-4" />,
    label: "생성 작업",
    variant: "success",
  },
  update: {
    icon: <Edit className="h-4 w-4" />,
    label: "수정 작업",
    variant: "warning",
  },
  query: {
    icon: <Search className="h-4 w-4" />,
    label: "조회 작업",
    variant: "default",
  },
};

export function ApprovalCard({
  interruptData,
  onApprove,
  onReject,
  isLoading,
}: ApprovalCardProps) {
  const config = taskTypeConfig[interruptData.taskType] || taskTypeConfig.query;

  return (
    <Card className="w-full border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-xl">⏸️</span>
          승인이 필요합니다
        </CardTitle>
        <CardDescription>{interruptData.question}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Alert variant={config.variant}>
          {config.icon}
          <AlertTitle>{config.label}</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap font-mono text-sm">
            {interruptData.actionPlan}
          </AlertDescription>
        </Alert>
      </CardContent>

      <CardFooter className="gap-3">
        <Button
          onClick={onApprove}
          disabled={isLoading}
          className="flex-1"
          variant="default"
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          {isLoading ? "처리 중..." : "승인"}
        </Button>
        <Button
          onClick={onReject}
          disabled={isLoading}
          className="flex-1"
          variant="destructive"
        >
          <XCircle className="mr-2 h-4 w-4" />
          {isLoading ? "처리 중..." : "거부"}
        </Button>
      </CardFooter>
    </Card>
  );
}
