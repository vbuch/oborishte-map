variable "project_id" {
  description = "Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud region for resources"
  type        = string
  default     = "europe-west1"
}

variable "image_registry" {
  description = "Container image registry"
  type        = string
  default     = "gcr.io"
}

variable "image_name" {
  description = "Container image name"
  type        = string
  default     = "oborishte-ingest"
}

variable "image_tag" {
  description = "Container image tag"
  type        = string
  default     = "latest"
}

variable "schedule_timezone" {
  description = "Timezone for scheduler jobs"
  type        = string
  default     = "Europe/Sofia"
}

variable "schedules" {
  description = "Cron schedules for each job (in cron format: minute hour day month weekday)"
  type = object({
    crawl_rayon_oborishte = string
    crawl_sofia           = string
    crawl_sofiyska_voda   = string
    crawl_toplo           = string
    crawl_erm_zapad       = string
    ingest                = string
    notify                = string
  })
  default = {
    crawl_rayon_oborishte = "0 10,14,16 * * *"   # 3x daily: 10:00, 14:00, 16:00
    crawl_sofia           = "5 10,14,16 * * *"   # 3x daily: 10:05, 14:05, 16:05
    crawl_sofiyska_voda   = "10 10,14,16 * * *"  # 3x daily: 10:10, 14:10, 16:10
    crawl_toplo           = "15 10,14,16 * * *"  # 3x daily: 10:15, 14:15, 16:15
    crawl_erm_zapad       = "20 10,14,16 * * *"  # 3x daily: 10:20, 14:20, 16:20
    ingest                = "30 10,14,16 * * *"  # 3x daily: 10:30, 14:30, 16:30
    notify                = "45 10,14,16 * * *"  # 3x daily: 10:45, 14:45, 16:45
  }
}

variable "firebase_project_id" {
  description = "Firebase project ID (can be public)"
  type        = string
}
