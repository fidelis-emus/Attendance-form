import { generateId } from "./postgres-db";
import { whatsappService } from "./whatsapp-service";

export interface QueueItem {
  id: string;
  personId: string;
  firstName: string;
  lastName: string;
  whatsAppNumber: string;
  personType: "member" | "worker";
  messageType: string;
  messageContent: string;
  status: "Pending" | "Sending" | "Sent" | "Failed" | "Skipped";
  retryCount: number;
  scheduledTime?: string;
  sentTime?: string;
  errorMessage?: string;
  campaignRunId: string;
  batchLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface QueueProgress {
  active: boolean;
  campaignType: string;
  currentBatch: string;
  currentProgress: number;
  totalInBatch: number;
  totalProcessed: number;
  totalTargeted: number;
  status: "idle" | "running" | "paused" | "stopped";
}

class QueueService {
  private db: any = null;
  private io: any = null;
  private isProcessing = false;
  private workerStatus: "idle" | "running" | "paused" | "stopped" = "idle";
  private activeCampaignId: string | null = null;
  private activeCampaignType: string = "";
  private autoResumeTimer: any = null;

  async init(getDbFn: () => Promise<any>, ioServer: any) {
    this.db = await getDbFn();
    this.io = ioServer;
    console.log("[QueueService] Initialized and connected to DB.");

    // Recover pending items in case of a crash or reboot
    await this.recoverQueue();

    // Start auto-resume checker for connection drops
    this.startAutoConnectionCheck();
  }

  // Auto-resume checking if WhatsApp reconnects
  startAutoConnectionCheck() {
    if (this.autoResumeTimer) return;
    this.autoResumeTimer = setInterval(async () => {
      if (this.workerStatus === "paused") {
        const isConnected = whatsappService.getStatus().status === "connected";
        if (isConnected) {
          console.log("[QueueService] WhatsApp connection verified. Automatically resuming paused queue...");
          await this.resumeWorker();
        }
      }
    }, 10000);
  }

  // Recover state when the server restarts
  async recoverQueue() {
    try {
      // Find any items that were left in 'Sending' status (which means server crashed mid-send)
      // or 'Pending' items that should be processed.
      const interrupted = await this.db.collection("message_queue").find({ status: "Sending" }).toArray();
      if (interrupted.length > 0) {
        console.log(`[QueueService] Recovering ${interrupted.length} interrupted messages left in 'Sending' state.`);
        for (const item of interrupted) {
          await this.db.collection("message_queue").updateOne(
            { id: item.id },
            { $set: { status: "Pending", errorMessage: "Server restart recovery", updatedAt: new Date().toISOString() } }
          );
        }
      }

      // Check if we should automatically start processing pending items
      const pendingCount = await this.db.collection("message_queue").countDocuments({ status: "Pending" });
      if (pendingCount > 0) {
        console.log(`[QueueService] Found ${pendingCount} pending messages in queue. Resuming processor.`);
        this.startWorker();
      }
    } catch (err) {
      console.error("[QueueService] Recovery failed:", err);
    }
  }

  // Add messages to the queue
  async addToQueue(items: Omit<QueueItem, "id" | "status" | "retryCount" | "createdAt" | "updatedAt">[]) {
    try {
      const now = new Date().toISOString();
      const insertItems = items.map((item) => ({
        ...item,
        id: "q_" + generateId(),
        status: "Pending",
        retryCount: 0,
        createdAt: now,
        updatedAt: now,
      }));

      if (insertItems.length > 0) {
        await this.db.collection("message_queue").insertMany(insertItems);
        console.log(`[QueueService] Added ${insertItems.length} messages to the queue.`);
        
        // Update active campaign variables if this is a bulk campaign
        this.activeCampaignId = insertItems[0].campaignRunId;
        this.activeCampaignType = insertItems[0].messageType;

        // Auto trigger queue processing
        if (this.workerStatus !== "paused") {
          this.startWorker();
        } else {
          this.notifyProgress();
        }
      }
    } catch (err) {
      console.error("[QueueService] Add to queue failed:", err);
    }
  }

  // Control operations
  async startWorker() {
    if (this.workerStatus === "running") return;
    this.workerStatus = "running";
    console.log("[QueueService] Queue worker STARTED.");
    this.notifyProgress();
    this.processQueueLoop();
  }

  async pauseWorker() {
    this.workerStatus = "paused";
    console.log("[QueueService] Queue worker PAUSED.");
    this.notifyProgress();
  }

  async resumeWorker() {
    if (this.workerStatus === "running") return;
    this.workerStatus = "running";
    console.log("[QueueService] Queue worker RESUMED.");
    this.notifyProgress();
    this.processQueueLoop();
  }

  async stopWorker() {
    this.workerStatus = "stopped";
    console.log("[QueueService] Queue worker STOPPED.");
    
    // Mark all currently Pending or Sending items as Stopped/Cancelled
    await this.db.collection("message_queue").updateMany(
      { status: { $in: ["Pending", "Sending"] } },
      { $set: { status: "Failed", errorMessage: "Campaign aborted by administrator", updatedAt: new Date().toISOString() } }
    );

    this.notifyProgress();
  }

  // Get active queue progress summary
  async getProgress(): Promise<QueueProgress> {
    try {
      const activeStates = ["Pending", "Sending", "Sent", "Failed"];
      const totalCount = await this.db.collection("message_queue").countDocuments({
        campaignRunId: this.activeCampaignId || { $ne: "" }
      });
      const processedCount = await this.db.collection("message_queue").countDocuments({
        campaignRunId: this.activeCampaignId || { $ne: "" },
        status: { $in: ["Sent", "Failed"] }
      });
      const currentSendingItem = await this.db.collection("message_queue").findOne({
        campaignRunId: this.activeCampaignId || { $ne: "" },
        status: "Sending"
      });

      const currentBatch = currentSendingItem?.batchLabel || "Batch A";
      
      const inBatchTotal = await this.db.collection("message_queue").countDocuments({
        campaignRunId: this.activeCampaignId || { $ne: "" },
        batchLabel: currentBatch
      });
      const inBatchProcessed = await this.db.collection("message_queue").countDocuments({
        campaignRunId: this.activeCampaignId || { $ne: "" },
        batchLabel: currentBatch,
        status: { $in: ["Sent", "Failed"] }
      });

      const isActive = this.workerStatus === "running" && totalCount > processedCount;

      return {
        active: isActive,
        campaignType: this.activeCampaignType || "Background Campaign",
        currentBatch,
        currentProgress: inBatchProcessed,
        totalInBatch: inBatchTotal || 1,
        totalProcessed: processedCount,
        totalTargeted: totalCount,
        status: this.workerStatus,
      };
    } catch (err) {
      return {
        active: false,
        campaignType: "Background Campaign",
        currentBatch: "Batch A",
        currentProgress: 0,
        totalInBatch: 1,
        totalProcessed: 0,
        totalTargeted: 0,
        status: "idle",
      };
    }
  }

  // Emit real-time progress to connected sockets
  async notifyProgress() {
    if (!this.io) return;
    const progress = await this.getProgress();
    this.io.emit("queue_progress", progress);
  }

  // Sequential queue processor
  private async processQueueLoop() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.workerStatus === "running") {
      try {
        // Find next item to process sequentially, sorted by creation date
        const nextItem = await this.db.collection("message_queue").findOne(
          { status: "Pending" },
          { sort: { createdAt: 1 } }
        );

        if (!nextItem) {
          console.log("[QueueService] Queue is empty. Going idle.");
          this.workerStatus = "idle";
          this.notifyProgress();
          break;
        }

        // Check if WhatsApp is connected
        const connStatus = whatsappService.getStatus();
        if (connStatus.status !== "connected") {
          console.log("[QueueService] WhatsApp is disconnected. Auto-pausing queue worker...");
          this.workerStatus = "paused";
          this.notifyProgress();
          break;
        }

        // Lock item in Sending state
        await this.db.collection("message_queue").updateOne(
          { id: nextItem.id },
          { $set: { status: "Sending", updatedAt: new Date().toISOString() } }
        );
        this.notifyProgress();

        // Send message
        let deliveryStatus: "Sent" | "Failed" = "Sent";
        let wamid: string | null = null;
        let errMsg = "";

        try {
          // Send message via whatsappService
          wamid = await whatsappService.sendMessage(nextItem.whatsAppNumber, nextItem.messageContent);
        } catch (err: any) {
          console.error(`[QueueService] Send failed to ${nextItem.whatsAppNumber}:`, err.message);
          deliveryStatus = "Failed";
          errMsg = err.message || "Unknown delivery failure";
        }

        const nowStr = new Date().toISOString();
        const dateSentStr = nowStr.split("T")[0];
        const timeSentStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

        // Update queue item in DB
        await this.db.collection("message_queue").updateOne(
          { id: nextItem.id },
          {
            $set: {
              status: deliveryStatus,
              sentTime: nowStr,
              errorMessage: deliveryStatus === "Failed" ? errMsg : undefined,
              updatedAt: nowStr,
            }
          }
        );

        // Synchronize with whatsapp_logs
        await this.db.collection("whatsapp_logs").insertOne({
          id: generateId(),
          personId: nextItem.personId,
          personName: `${nextItem.firstName} ${nextItem.lastName}`,
          personType: nextItem.personType,
          whatsAppNumber: nextItem.whatsAppNumber,
          messageContent: nextItem.messageContent,
          sentAt: nowStr,
          dateSent: dateSentStr,
          timeSent: timeSentStr,
          deliveryStatus,
          readStatus: "Unread",
          messageStatus: deliveryStatus,
          messageType: nextItem.messageType,
          failedStatus: deliveryStatus === "Failed" ? errMsg : "",
          wamid,
          campaignRunId: nextItem.campaignRunId,
          batchLabel: nextItem.batchLabel,
        });

        // Synchronize with scheduler_runs targets
        await this.db.collection("scheduler_runs").updateOne(
          { id: nextItem.campaignRunId, "targets.personId": nextItem.personId },
          {
            $set: {
              "targets.$.status": deliveryStatus,
              "targets.$.error": deliveryStatus === "Failed" ? errMsg : undefined,
            },
            $inc: {
              processedCount: deliveryStatus === "Sent" ? 1 : 0,
              failedCount: deliveryStatus === "Failed" ? 1 : 0,
            }
          }
        );

        // Update the person's messageSent flag in rosters
        const colName = nextItem.personType === "worker" ? "workers" : "members";
        await this.db.collection(colName).updateOne(
          { id: nextItem.personId },
          { $set: { messageSent: true, lastAttendanceDate: dateSentStr, messageDeliveryStatus: deliveryStatus } }
        );

        this.notifyProgress();

        // Random delay of 15-30 seconds after processing each item
        if (this.workerStatus === "running") {
          const delay = Math.floor(Math.random() * (30000 - 15000 + 1)) + 15000;
          console.log(`[QueueService] Waiting ${delay / 1000} seconds before next message...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

      } catch (loopErr) {
        console.error("[QueueService] Error in loop iteration:", loopErr);
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Delay slightly on uncaught loop error
      }
    }

    this.isProcessing = false;
  }

  // Cancel remaining pending items for a run
  async cancelCampaign(campaignRunId: string) {
    try {
      const result = await this.db.collection("message_queue").updateMany(
        { campaignRunId, status: "Pending" },
        { $set: { status: "Failed", errorMessage: "Cancelled by administrator", updatedAt: new Date().toISOString() } }
      );
      console.log(`[QueueService] Cancelled ${result.modifiedCount} pending items for campaign ${campaignRunId}`);
      this.notifyProgress();
    } catch (err) {
      console.error("[QueueService] Cancel campaign failed:", err);
    }
  }

  // Retry a single failed item
  async retryItem(id: string) {
    try {
      const item = await this.db.collection("message_queue").findOne({ id });
      if (!item) return false;

      await this.db.collection("message_queue").updateOne(
        { id },
        { $set: { status: "Pending", errorMessage: undefined, retryCount: item.retryCount + 1, updatedAt: new Date().toISOString() } }
      );

      if (this.workerStatus !== "paused") {
        this.startWorker();
      } else {
        this.notifyProgress();
      }
      return true;
    } catch (err) {
      console.error("[QueueService] Retry item failed:", err);
      return false;
    }
  }
}

export const queueService = new QueueService();
