terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Recommended: Store state in GCS for team collaboration and CI/CD
  backend "gcs" {
    bucket = "oborishte-map-terraform-state"
    prefix = "oborishte-ingest"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "run" {
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloudbuild" {
  service            = "cloudbuild.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloudscheduler" {
  service            = "cloudscheduler.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "firestore" {
  service            = "firestore.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "secretmanager" {
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

# Service Account for running jobs
resource "google_service_account" "ingest_runner" {
  account_id   = "ingest-runner"
  display_name = "Ingestion Pipeline Runner"
  description  = "Service account for running ingestion pipeline jobs"
}

# Grant Firestore access
resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.ingest_runner.email}"
}

# Grant Cloud Run Invoker (for scheduler to trigger jobs)
resource "google_project_iam_member" "run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.ingest_runner.email}"
}

# Grant Secret Manager access
resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.ingest_runner.email}"
}

# Reference existing secrets (these should be created manually or via setup script)
# We use data sources to reference secrets that should be created before running terraform
data "google_secret_manager_secret" "firebase_sa_key" {
  secret_id = "firebase-service-account-key"
  project   = var.project_id
  
  depends_on = [google_project_service.secretmanager]
}

data "google_secret_manager_secret" "google_ai_api_key" {
  secret_id = "google-ai-api-key"
  project   = var.project_id
  
  depends_on = [google_project_service.secretmanager]
}

data "google_secret_manager_secret" "google_ai_model" {
  secret_id = "google-ai-model"
  project   = var.project_id
  
  depends_on = [google_project_service.secretmanager]
}

data "google_secret_manager_secret" "google_maps_api_key" {
  secret_id = "google-maps-api-key"
  project   = var.project_id
  
  depends_on = [google_project_service.secretmanager]
}

# Cloud Run Jobs
locals {
  crawlers = {
    rayon-oborishte = {
      source       = "rayon-oborishte-bg"
      schedule     = var.schedules.crawl_rayon_oborishte
      memory       = "512Mi"
      timeout      = "1800s"
      description  = "Crawl Rayon Oborishte website"
    }
    sofia = {
      source       = "sofia-bg"
      schedule     = var.schedules.crawl_sofia
      memory       = "1Gi"
      timeout      = "1800s"
      description  = "Crawl Sofia municipality"
    }
    sofiyska-voda = {
      source       = "sofiyska-voda"
      schedule     = var.schedules.crawl_sofiyska_voda
      memory       = "512Mi"
      timeout      = "1800s"
      description  = "Crawl Sofiyska Voda"
    }
    toplo = {
      source       = "toplo-bg"
      schedule     = var.schedules.crawl_toplo
      memory       = "512Mi"
      timeout      = "1800s"
      description  = "Crawl Toplo BG"
    }
  }
}

resource "google_cloud_run_v2_job" "crawlers" {
  for_each = local.crawlers
  
  name     = "crawl-${each.key}"
  location = var.region

  template {
    template {
      service_account = google_service_account.ingest_runner.email
      timeout         = each.value.timeout
      
      containers {
        image = "${var.image_registry}/${var.project_id}/${var.image_name}:${var.image_tag}"
        args  = ["tsx", "crawl.ts", "--source", each.value.source]
        
        resources {
          limits = {
            cpu    = "1"
            memory = each.value.memory
          }
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }
        
        # Secret environment variables from Secret Manager
        env {
          name = "FIREBASE_SERVICE_ACCOUNT_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.firebase_sa_key.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "GOOGLE_AI_API_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_ai_api_key.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "GOOGLE_AI_MODEL"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_ai_model.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_maps_api_key.secret_id
              version = "latest"
            }
          }
        }
        
        # Public Firebase config (these can be in code or here)
        env {
          name  = "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
          value = var.firebase_project_id
        }
        
        env {
          name  = "NEXT_PUBLIC_APP_URL"
          value = "https://oboapp.online"
        }
      }
      
      max_retries = 1
    }
  }

  lifecycle {
    ignore_changes = [
      launch_stage,
    ]
  }

  depends_on = [
    google_project_service.run
  ]
}

resource "google_cloud_run_v2_job" "ingest" {
  name     = "ingest-messages"
  location = var.region

  template {
    template {
      service_account = google_service_account.ingest_runner.email
      timeout         = "1800s"
      
      containers {
        image = "${var.image_registry}/${var.project_id}/${var.image_name}:${var.image_tag}"
        args  = ["tsx", "ingest.ts"]
        
        resources {
          limits = {
            cpu    = "1"
            memory = "1Gi"
          }
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }
        
        # Secret environment variables from Secret Manager
        env {
          name = "FIREBASE_SERVICE_ACCOUNT_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.firebase_sa_key.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "GOOGLE_AI_API_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_ai_api_key.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "GOOGLE_AI_MODEL"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_ai_model.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_maps_api_key.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name  = "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
          value = var.firebase_project_id
        }
        
        env {
          name  = "NEXT_PUBLIC_APP_URL"
          value = "https://oboapp.online"
        }
      }
      
      max_retries = 1
    }
  }

  lifecycle {
    ignore_changes = [
      launch_stage,
    ]
  }

  depends_on = [
    google_project_service.run
  ]
}

resource "google_cloud_run_v2_job" "notify" {
  name     = "send-notifications"
  location = var.region

  template {
    template {
      service_account = google_service_account.ingest_runner.email
      timeout         = "1800s"
      
      containers {
        image = "${var.image_registry}/${var.project_id}/${var.image_name}:${var.image_tag}"
        args  = ["tsx", "notify.ts"]
        
        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }
        
        # Secret environment variables from Secret Manager
        env {
          name = "FIREBASE_SERVICE_ACCOUNT_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.firebase_sa_key.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "GOOGLE_AI_API_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_ai_api_key.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "GOOGLE_AI_MODEL"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_ai_model.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_maps_api_key.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name  = "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
          value = var.firebase_project_id
        }
        
        env {
          name  = "NEXT_PUBLIC_APP_URL"
          value = "https://oboapp.online"
        }
      }
      
      max_retries = 1
    }
  }

  lifecycle {
    ignore_changes = [
      launch_stage,
    ]
  }

  depends_on = [
    google_project_service.run
  ]
}

# Cloud Scheduler Jobs
resource "google_cloud_scheduler_job" "crawler_schedules" {
  for_each = local.crawlers
  
  name             = "crawl-${each.key}-schedule"
  description      = each.value.description
  schedule         = each.value.schedule
  time_zone        = var.schedule_timezone
  attempt_deadline = "320s"
  region           = var.region

  retry_config {
    retry_count = 1
  }

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/crawl-${each.key}:run"

    oauth_token {
      service_account_email = google_service_account.ingest_runner.email
    }
  }

  depends_on = [
    google_project_service.cloudscheduler,
    google_cloud_run_v2_job.crawlers
  ]
}

resource "google_cloud_scheduler_job" "ingest_schedule" {
  name             = "ingest-schedule"
  description      = "Process all messages through AI ingestion pipeline"
  schedule         = var.schedules.ingest
  time_zone        = var.schedule_timezone
  attempt_deadline = "320s"
  region           = var.region

  retry_config {
    retry_count = 1
  }

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/ingest-messages:run"

    oauth_token {
      service_account_email = google_service_account.ingest_runner.email
    }
  }

  depends_on = [
    google_project_service.cloudscheduler,
    google_cloud_run_v2_job.ingest
  ]
}

resource "google_cloud_scheduler_job" "notify_schedule" {
  name             = "notify-schedule"
  description      = "Match and send notifications to users"
  schedule         = var.schedules.notify
  time_zone        = var.schedule_timezone
  attempt_deadline = "320s"
  region           = var.region

  retry_config {
    retry_count = 1
  }

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/send-notifications:run"

    oauth_token {
      service_account_email = google_service_account.ingest_runner.email
    }
  }

  depends_on = [
    google_project_service.cloudscheduler,
    google_cloud_run_v2_job.notify
  ]
}
